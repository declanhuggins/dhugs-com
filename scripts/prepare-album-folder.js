// Prepare a YYYY/YYYY-MM-DD Title album folder by converting the PNG source folder to AVIF/JPG.
// This wraps tools/convert.sh.
// It looks for a child folder matching 'Mmm D' inside the album folder and runs convert.sh on it.
// Usage:
//   node scripts/prepare-album-folder.js --album "/Volumes/Drive/Photos/2025/2025-09-12 My Album"

const fs = require('fs');
const path = require('path');
const readline = require('node:readline');
const { execa } = require('execa');
const sharp = require('sharp');

function parseArgs() {
  const out = {};
  for (let i=2;i<process.argv.length;i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const v = process.argv[i+1] && !process.argv[i+1].startsWith('--') ? process.argv[++i] : 'true';
    out[k] = v;
  }
  return out;
}

async function main() {
  const args = parseArgs();
  let albumDir = args.album || args.dir;

  async function prompt(q) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(res => rl.question(q, ans => { rl.close(); res(ans); }));
  }

  while (!albumDir || !fs.existsSync(albumDir)) {
    const entered = await prompt('Path to album folder (YYYY-MM-DD Title): ');
    if (!entered) continue;
    if (!fs.existsSync(entered)) {
      console.error('Not found:', entered);
      continue;
    }
    albumDir = entered;
  }

  const kids = fs.readdirSync(albumDir).filter(n => fs.statSync(path.join(albumDir,n)).isDirectory());
  if (!kids.length) throw new Error('No subfolders found inside album directory');
  // Heuristic: pick the folder whose name matches 'Mon D' like 'Sep 12'
  let monDay = kids.find(n => /^([A-Z][a-z]{2})\s+\d{1,2}$/.test(n)) || kids[0];
  if (kids.length > 1) {
    console.log('Subfolders:');
    kids.forEach((n,i) => console.log(`  [${i+1}] ${n}${n===monDay?' (default)':''}`));
    const idxStr = await prompt('Choose source folder index (Enter for default): ');
    const idx = parseInt(idxStr||'0',10);
    if (idx >= 1 && idx <= kids.length) monDay = kids[idx-1];
  }
  if (!monDay) throw new Error('Could not find a PNG source folder inside album directory');
  const src = path.join(albumDir, monDay);
  console.log('Running convert.sh on:', src);
  await execa('bash', ['tools/convert.sh', src], { stdio: 'inherit' });
  console.log('Done. Created:', `${src} Avif`, 'and', `${src} JPG`);

  // Optional: choose a thumbnail from the generated AVIFs
  const avifDir = `${src} Avif`;
  if (fs.existsSync(avifDir)) {
    const files = fs.readdirSync(avifDir)
      .filter(f => f.toLowerCase().endsWith('.avif'))
      .filter(f => !f.startsWith('.')); // skip macOS dotfiles like ._Resource
    if (files.length) {
      console.log('\nPick a thumbnail image (from AVIF outputs):');
      files.forEach((f,i) => console.log(`  [${i+1}] ${f}`));
      let choice;
      async function prompt(q){
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        return new Promise(res => rl.question(q, ans => { rl.close(); res(ans); }));
      }
      while (true) {
        const ans = await prompt('Enter index to preview (or press Enter to skip): ');
        if (!ans) break;
        const idx = parseInt(ans,10);
        if (!Number.isFinite(idx) || idx < 1 || idx > files.length) { console.error('Invalid index'); continue; }
        choice = files[idx-1];
        const full = path.join(avifDir, choice);
        try {
          // Try to open preview (macOS: open, Linux: xdg-open). Ignore failures.
          const opener = process.platform === 'darwin' ? 'open' : (process.platform === 'win32' ? 'start' : 'xdg-open');
          await execa(opener, [full], { stdio: 'ignore', shell: process.platform === 'win32' });
        } catch {}
        const confirm = (await prompt('Use this as thumbnail? (y/N): ')).trim().toLowerCase();
        if (confirm === 'y' || confirm === 'yes') {
          // Prefer using corresponding JPG as source (to avoid AVIF decode issues)
          const base = choice.replace(/\.avif$/i, '');
          const jpgDir = `${src} JPG`;
          const jpgPath = path.join(jpgDir, base + '.jpg');
          const pngPath = path.join(src, base + '.png');
          let source = fs.existsSync(jpgPath) ? jpgPath : (fs.existsSync(pngPath) ? pngPath : full);
          const outPath = path.join(albumDir, 'thumbnail.avif');

          // Compute largest centered 3:2 crop box
          let ow = 0, oh = 0;
          try {
            const meta = await sharp(source).rotate().metadata();
            ow = meta.width || 0; oh = meta.height || 0;
          } catch {}

          if (!ow || !oh) {
            // Fallback: use ImageMagick identify for dimensions
            try {
              const { execa } = await import('execa');
              const { stdout } = await execa('magick', ['identify','-format','%w %h', source], { stdout: 'pipe' });
              const parts = String(stdout || '').trim().split(/\s+/);
              ow = parseInt(parts[0]||'0',10); oh = parseInt(parts[1]||'0',10);
            } catch {}
          }
          if (!ow || !oh) throw new Error('Unable to read image dimensions for preview');
          const targetHFromW = Math.floor((ow * 2) / 3);
          let cw, ch;
          if (targetHFromW <= oh) { cw = ow; ch = targetHFromW; } else { ch = oh; cw = Math.floor((oh * 3) / 2); }
          const left = Math.floor((ow - cw) / 2);
          const top = Math.floor((oh - ch) / 2);

          // Try Sharp crop; fallback to ImageMagick crop if Sharp fails (e.g., AVIF decoding)
          let wrote = false;
          try {
            await sharp(source)
              .rotate()
              .extract({ left, top, width: cw, height: ch })
              .toFormat('avif', { quality: 60 })
              .toFile(outPath);
            wrote = true;
          } catch (e) {
            try {
              await execa('magick', [source, '-gravity','center','-crop', `${cw}x${ch}+${left}+${top}`, '+repage', outPath]);
              wrote = true;
            } catch (e2) {
              console.error('Failed to write thumbnail with Sharp and ImageMagick');
              throw e2;
            }
          }
          if (wrote) console.log('Wrote thumbnail:', outPath);
          break;
        } else {
          console.log('Okay, pick another.');
        }
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
