// Publish or update the special 'portfolio' album to R2 only (no D1 row)
// Usage:
//   node scripts/publish-portfolio.js --dir ./out-avif [--thumb DSC00123.avif]
//   CF_ENV=prod node scripts/publish-portfolio.js --dir ./out-avif

const fs = require('fs');
const path = require('path');
const { execa } = require('execa');
const readline = require('node:readline');
const sharp = require('sharp');
require('dotenv').config({ quiet: true });

const RESPONSIVE_SIZES = { s: 320, m: 640, l: 1280 };

let __s3Client = null;
async function getS3Client() {
  if (__s3Client) return __s3Client;
  const { S3Client } = await import('@aws-sdk/client-s3');
  const endpoint = process.env.S3_ENDPOINT || process.env.AWS_S3_ENDPOINT || '';
  const region = process.env.AWS_REGION || 'auto';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID_WRITE || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY_WRITE || process.env.AWS_SECRET_ACCESS_KEY;
  __s3Client = new S3Client({ region, endpoint, forcePathStyle: true, credentials: (accessKeyId && secretAccessKey) ? { accessKeyId, secretAccessKey } : undefined });
  return __s3Client;
}

async function s3PutFile(bucket, key, filePath, contentType, metadata) {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const s3 = await getS3Client();
  const Body = fs.createReadStream(filePath);
  const params = { Bucket: bucket, Key: key, Body, ContentType: contentType };
  if (metadata && Object.keys(metadata).length) params.Metadata = metadata;
  await s3.send(new PutObjectCommand(params));
}

function getR2BucketName() {
  if (process.env.R2_BUCKET_NAME) return process.env.R2_BUCKET_NAME;
  try {
    const cfg = fs.readFileSync(path.join(process.cwd(), 'wrangler.jsonc'), 'utf8');
    const m = cfg.match(/"bucket_name"\s*:\s*"([^"]+)"/);
    if (m) return m[1];
  } catch {}
  return 'dhugs-assets';
}

function parseArgs() {
  const out = {};
  for (let i=2;i<process.argv.length;i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const v = process.argv[i+1] && !process.argv[i+1].startsWith('--') ? process.argv[++i] : '';
    out[k] = v;
  }
  return out;
}

async function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, ans => { rl.close(); res(ans); }));
}

async function uploadAvifs(avifDir, prefix) {
  const bucket = getR2BucketName();
  const entries = fs.readdirSync(avifDir)
    .filter(f => f.toLowerCase().endsWith('.avif'))
    .filter(f => !f.startsWith('.'))
    .filter(f => f.toLowerCase() !== 'thumbnail.avif');
  if (!entries.length) throw new Error('No .avif files found in ' + avifDir);
  console.log(`Uploading ${entries.length} AVIF(s) to r2://${prefix}/`);
  for (const f of entries) {
    const key = `${prefix}/${f}`;
    const full = path.join(avifDir, f);
    let w = 0, h = 0;
    try { const info = await sharp(full).metadata(); w = info.width || 0; h = info.height || 0; } catch {}
    await s3PutFile(bucket, key, full, 'image/avif', w && h ? { width: String(w), height: String(h) } : undefined);
  }
  return entries;
}

async function uploadThumbnail(avifDir, uploaded, destThumbKey, chosenOrPath) {
  const absProvided = chosenOrPath && path.isAbsolute(chosenOrPath) && fs.existsSync(chosenOrPath);
  const file = absProvided ? path.basename(chosenOrPath) : (chosenOrPath && uploaded.includes(chosenOrPath) ? chosenOrPath : uploaded[0]);
  console.log('Preparing portfolio thumbnail from', file);
  const srcPathAvif = absProvided ? chosenOrPath : path.join(avifDir, file);
  const base = file.replace(/\.avif$/i,'');
  const jpgDirGuess = avifDir.endsWith(' Avif') ? avifDir.replace(/ Avif$/,' JPG') : path.join(path.dirname(avifDir), path.basename(avifDir).replace(/Avif$/,'JPG'));
  const jpgCandidate = path.join(jpgDirGuess, base + '.jpg');
  const sourcePath = fs.existsSync(jpgCandidate) ? jpgCandidate : srcPathAvif;

  const meta = await sharp(sourcePath).rotate().metadata();
  const ow = meta.width || 0;
  const oh = meta.height || 0;
  if (!ow || !oh) throw new Error('Unable to read image dimensions for ' + sourcePath);
  const targetHFromW = Math.floor((ow * 2) / 3);
  let cw, ch;
  if (targetHFromW <= oh) { cw = ow; ch = targetHFromW; } else { ch = oh; cw = Math.floor((oh * 3) / 2); }
  const left = Math.floor((ow - cw) / 2);
  const top = Math.floor((oh - ch) / 2);

  const tmpOut = path.join(process.cwd(), `.thumb-${Date.now()}.avif`);
  try {
    await sharp(sourcePath).rotate().extract({ left, top, width: cw, height: ch }).toFormat('avif').toFile(tmpOut);
    await s3PutFile(getR2BucketName(), destThumbKey, tmpOut, 'image/avif');
  } finally {
    try { fs.unlinkSync(tmpOut); } catch {}
  }
  return file;
}

async function generateThumbnailResponsiveSizes(avifDir, chosenOrPath, portfolioRoot) {
  const bucket = getR2BucketName();
  const RESPONSIVE_SIZES = { s: 320, m: 640, l: 1280 };
  const absProvided = chosenOrPath && path.isAbsolute(chosenOrPath) && fs.existsSync(chosenOrPath);
  // Resolve preferred source (JPG sibling if exists)
  const pickName = absProvided ? path.basename(chosenOrPath) : chosenOrPath;
  const srcAvif = absProvided ? chosenOrPath : path.join(avifDir, pickName);
  const base = (pickName || '').replace(/\.avif$/i,'');
  const jpgDirGuess = avifDir.endsWith(' Avif') ? avifDir.replace(/ Avif$/,' JPG') : path.join(path.dirname(avifDir), path.basename(avifDir).replace(/Avif$/,'JPG'));
  const jpgCandidate = path.join(jpgDirGuess, base + '.jpg');
  const sourcePath = (pickName && fs.existsSync(jpgCandidate)) ? jpgCandidate : srcAvif;

  const meta = await sharp(sourcePath).rotate().metadata();
  const ow = meta.width || 0;
  const oh = meta.height || 0;
  if (!ow || !oh) throw new Error('Unable to read image dimensions for ' + sourcePath);
  const targetHFromW = Math.floor((ow * 2) / 3);
  let cw, ch;
  if (targetHFromW <= oh) { cw = ow; ch = targetHFromW; } else { ch = oh; cw = Math.floor((oh * 3) / 2); }
  const left = Math.floor((ow - cw) / 2);
  const top = Math.floor((oh - ch) / 2);

  for (const [tier, width] of Object.entries(RESPONSIVE_SIZES)) {
    const key = `${tier}/portfolio/thumbnail.avif`;
    const tmpOut = path.join(process.cwd(), `.thumb-${tier}-${Date.now()}-${Math.random().toString(36).slice(2)}.avif`);
    try {
      await sharp(sourcePath).rotate().extract({ left, top, width: cw, height: ch }).resize({ width: Number(width) }).toFormat('avif').toFile(tmpOut);
      await s3PutFile(bucket, key, tmpOut, 'image/avif');
    } finally {
      try { fs.unlinkSync(tmpOut); } catch {}
    }
  }
}

async function generateResponsiveSizes(avifDir, uploaded, portfolioRoot) {
  const bucket = getR2BucketName();
  // Prefer sibling JPG folder as source if available to avoid AVIF decode hiccups
  const avifBase = path.basename(avifDir);
  const jpgSiblingCandidates = [
    path.join(path.dirname(avifDir), avifBase.replace(/Avif$/i, 'JPG')),
    path.join(path.dirname(avifDir), avifBase.replace(/Avif$/i, 'Jpg')),
    path.join(path.dirname(avifDir), avifBase.replace(/Avif$/i, ' jpg')),
  ];
  const jpgDir = jpgSiblingCandidates.find(p => { try { return fs.existsSync(p) && fs.statSync(p).isDirectory(); } catch { return false; } }) || null;

  for (const f of uploaded) {
    const base = f.replace(/\.avif$/i, '');
    const jpgPath = jpgDir ? [
      path.join(jpgDir, base + '.jpg'),
      path.join(jpgDir, base + '.JPG'),
      path.join(jpgDir, base + '.jpeg'),
      path.join(jpgDir, base + '.JPEG'),
      path.join(jpgDir, base + '.png'),
      path.join(jpgDir, base + '.PNG'),
    ].find(p => { try { return fs.existsSync(p); } catch { return false; } }) : null;
    const srcPath = jpgPath || path.join(avifDir, f);
    // Originals are already at o/portfolio/images via uploadAvifs.
    // Generate explicit tier keys to avoid replace() mismatches.
    for (const [k, width] of Object.entries(RESPONSIVE_SIZES)) {
      const key = `${k}/portfolio/images/${f}`;
      const tmp = path.join(process.cwd(), `.tmp-${k}-${Date.now()}-${Math.random().toString(36).slice(2)}.avif`);
      try {
        await sharp(srcPath).rotate().resize({ width: Number(width) }).toFormat('avif').toFile(tmp);
        await s3PutFile(bucket, key, tmp, 'image/avif');
      } catch (e) {
        console.warn(`Warning: failed to generate ${k} for ${f} from ${path.basename(srcPath)}:`, e.message || e);
      } finally { try { fs.unlinkSync(tmp); } catch {} }
    }
  }
}

async function writeManifestForPortfolio(avifDir, uploaded, portfolioRoot) {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const s3 = await getS3Client();
  const bucket = getR2BucketName();
  const images = [];
  for (const f of uploaded) {
    const filePath = path.join(avifDir, f);
    let w = 1600, h = 900;
    try {
      const meta = await sharp(filePath).metadata();
      if (meta.width && meta.height) { w = meta.width; h = meta.height; }
    } catch {}
    images.push({ filename: f, width: w, height: h, alt: f });
  }
  const body = JSON.stringify({ images });
  const key = `${portfolioRoot}/images/_manifest.json`;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'application/json', CacheControl: 'public, max-age=60' }));
  console.log('Wrote portfolio manifest:', key, `(${images.length} images)`);
}

async function main() {
  const args = parseArgs();
  let rootDir = args.dir;
  while (!rootDir || !fs.existsSync(rootDir)) {
    const entered = await prompt('Path to Portfolio folder (root or AVIF folder): ');
    if (!entered) continue;
    if (!fs.existsSync(entered)) { console.error('Not found:', entered); continue; }
    rootDir = entered;
  }
  rootDir = path.resolve(rootDir);

  function findAvifDir(root) {
    const entries = fs.readdirSync(root).filter(n => !n.startsWith('.'));
    const subdirs = entries
      .map(n => path.join(root, n))
      .filter(p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } });
    // Prefer explicit Avif-named folders first
    const named = subdirs.find(p => /(^|\b)avif$/i.test(path.basename(p))) ||
                  subdirs.find(p => /\bavif$/i.test(path.basename(p)));
    if (named) return named;
    // Otherwise any subdir that contains avifs
    const withAvifs = subdirs.find(p => {
      try {
        return fs.readdirSync(p).some(f => f.toLowerCase().endsWith('.avif') && !f.startsWith('.') && f.toLowerCase() !== 'thumbnail.avif');
      } catch { return false; }
    });
    if (withAvifs) return withAvifs;
    // Finally, allow root only if it contains real avifs (excluding thumbnail)
    const avifsHere = entries.filter(f => f.toLowerCase().endsWith('.avif') && !f.startsWith('.') && f.toLowerCase() !== 'thumbnail.avif');
    return avifsHere.length ? root : null;
  }

  const avifDir = findAvifDir(rootDir);
  if (!avifDir) throw new Error('Could not find an AVIF folder inside: ' + rootDir);
  console.log('Detected AVIF folder:', avifDir);
  // Portfolio root
  const portfolioRoot = 'o/portfolio';
  const imagesPrefix = `${portfolioRoot}/images`;

  // 1) Upload images
  const uploaded = await uploadAvifs(avifDir, imagesPrefix);

  // 2) Thumbnail
  let thumbPick = args.thumb || '';
  if (!thumbPick) {
    const candidates = ['thumbnail.avif','Thumbnail.avif','THUMBNAIL.AVIF'];
    const pre = candidates.map(n => path.join(avifDir,n)).find(p => fs.existsSync(p));
    if (pre) thumbPick = pre;
  }
  if (!thumbPick) {
    console.log('\nSelect thumbnail by index:');
    uploaded.forEach((f, i) => console.log(`${i + 1}. ${f}`));
    const idxStr = await prompt('Thumbnail index (1..n, default 1): ');
    const idx = Math.max(1, Math.min(uploaded.length, parseInt(idxStr || '1', 10) || 1));
    thumbPick = uploaded[idx - 1];
  }
  const thumbKey = `${portfolioRoot}/thumbnail.avif`;
  const picked = await uploadThumbnail(avifDir, uploaded, thumbKey, thumbPick);
  console.log('Uploaded thumbnail.');

  // 3) Generate s/m/l variants
  await generateResponsiveSizes(avifDir, uploaded, portfolioRoot);
  await generateThumbnailResponsiveSizes(avifDir, picked, portfolioRoot);
  console.log('Generated responsive sizes.');

  // 4) Write manifest for album-index generation fallback
  await writeManifestForPortfolio(avifDir, uploaded, portfolioRoot);

  console.log('\nPortfolio publish complete.');
  console.log('- Images prefix:', imagesPrefix);
}

main().catch(err => { console.error(err); process.exit(1); });
