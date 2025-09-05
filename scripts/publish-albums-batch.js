// Batch publish albums from an external drive hierarchy:
// Root/
//   YYYY/
//     YYYY-MM-DD Title/
//       Mmm D/ (PNG source) [optional]
//       Avif/ (converted AVIFs)
//       thumbnail.avif (optional, 3:2)
// Usage:
//   node scripts/publish-albums-batch.js --root /Volumes/Drive/Photos --author "Your Name" --tz "America/Chicago" --tags "Photography" [--dry]

const fs = require('fs');
const path = require('path');
const readline = require('node:readline');
const { execa } = require('execa');

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

function monthSlugFromDateString(ymd) {
  const d = new Date(ymd + 'T00:00:00Z');
  const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const mon = monthNames[d.getUTCMonth()];
  const day = String(d.getUTCDate()).padStart(2,'0');
  return `${mon}-${day}`;
}

async function main() {
  const args = parseArgs();
  function prompt(q) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(res => rl.question(q, ans => { rl.close(); res(ans); }));
  }

  let root = args.root || args.r;
  while (!root || !fs.existsSync(root)) {
    const entered = await prompt('Root path containing year folders (e.g., /Volumes/Drive/Photos): ');
    if (!entered) continue;
    if (!fs.existsSync(entered)) { console.error('Not found:', entered); continue; }
    root = entered;
  }
  let author = args.author || await prompt('Author (default Unknown Author): ');
  if (!author) author = 'Unknown Author';
  let tz = args.tz || await prompt('Timezone (e.g., America/Chicago, default America/Chicago): ');
  if (!tz) tz = 'America/Chicago';
  let tags = args.tags || await prompt('Default tags for all albums (comma separated, default Photography): ');
  if (!tags) tags = 'Photography';
  const dry = args.dry === 'true' || (/^y(es)?$/i).test((await prompt('Dry run? (y/N): ')).trim());

  const years = fs.readdirSync(root).filter(n => /^\d{4}$/.test(n));
  for (const year of years) {
    const yearDir = path.join(root, year);
    const albums = fs.readdirSync(yearDir).filter(n => /^\d{4}-\d{2}-\d{2}\s+/.test(n));
    for (const dirName of albums) {
      const fullAlbumDir = path.join(yearDir, dirName);
      const m = dirName.match(/^(\d{4})-(\d{2})-(\d{2})\s+(.*)$/);
      if (!m) continue;
      const ymd = `${m[1]}-${m[2]}-${m[3]}`;
      const title = m[4];
      const slug = monthSlugFromDateString(ymd);
      // Find a child dir that ends with ' Avif' or named 'Avif'
      const children = fs.readdirSync(fullAlbumDir).filter(n => fs.statSync(path.join(fullAlbumDir,n)).isDirectory());
      const avifDirName = children.find(d => /\bAvif$/.test(d)) || 'Avif';
      const avifCandidate = path.join(fullAlbumDir, avifDirName);
      const thumbCandidate = path.join(fullAlbumDir, 'thumbnail.avif');
      const avifDir = fs.existsSync(avifCandidate) ? avifCandidate : null;
      if (!avifDir) {
        console.warn('Skipping (missing Avif folder):', fullAlbumDir);
        continue;
      }
      const cmd = [
        'node','scripts/publish-album.js',
        '--dir', avifDir,
        '--title', title,
        '--date', `${ymd} ${tz}`,
        '--author', author,
        '--tags', tags,
        '--slug', slug,
        '--width', 'large'
      ];
      if (fs.existsSync(thumbCandidate)) { cmd.push('--thumb', thumbCandidate); }
      console.log('\nPublishing:', fullAlbumDir);
      if (dry) { console.log('DRY RUN:', ['env', ...cmd].join(' ')); continue; }
      await execa(cmd[0], cmd.slice(1), { stdio: 'inherit' });
    }
  }
  console.log('\nBatch publish complete.');
}

main().catch(e => { console.error(e); process.exit(1); });
