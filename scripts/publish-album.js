// Orchestrate publishing a new album to R2 + D1 in one go.
// Steps:
// 1) Upload AVIFs from a local folder to R2 under albums/YYYY/MM/slug/images/
// 2) Upload thumbnail.avif to albums/YYYY/MM/slug/thumbnail.avif (from chosen file)
// 3) Generate small/medium/large variants for that album only
// 4) Generate _meta.json (width/height) for that album
// 5) Upsert album row and tags into D1
// Usage examples:
//   node scripts/publish-album.js --dir ./out-avif --title "My Shoot" --date "2025-09-12 America/Chicago" --author "Your Name" --tags "Photography, Travel" --slug my-shoot --thumb DSC00123.avif --width large
//   CF_ENV=prod node scripts/publish-album.js --dir ./out-avif --title ...
//   node scripts/publish-album.js --dir ./out-avif --title "My Shoot" --date "2025-09-12 America/Chicago" --author "Me" --download_url "https://example.com/archive.zip"
// Flags:
//   --download_url <url>   Optional direct download/archive URL stored in posts.download_url.
//                          Provide the flag with no value (e.g. --download_url) to skip interactive prompt.

const fs = require('fs');
const path = require('path');
const { execa } = require('execa');
const readline = require('node:readline');
const sharp = require('sharp');
require('dotenv').config({ quiet: true });

// Shared responsive widths (o/ originals already uploaded separately)
const RESPONSIVE_SIZES = { s: 320, m: 640, l: 1280 };

// Minimal S3 helper for uploading with custom metadata (width/height)
let __s3Client = null;
async function getS3Client() {
  if (__s3Client) return __s3Client;
  const { S3Client } = await import('@aws-sdk/client-s3');
  const endpoint = process.env.S3_ENDPOINT || process.env.AWS_S3_ENDPOINT || '';
  const region = process.env.AWS_REGION || 'auto';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID_WRITE || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY_WRITE || process.env.AWS_SECRET_ACCESS_KEY;
  __s3Client = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: (accessKeyId && secretAccessKey) ? { accessKeyId, secretAccessKey } : undefined,
  });
  return __s3Client;
}

async function s3PutFile(bucket, key, filePath, contentType, metadata) {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const s3 = await getS3Client();
  const Body = fs.createReadStream(filePath);
  const params = { Bucket: bucket, Key: key, Body, ContentType: contentType };
  if (metadata && Object.keys(metadata).length) params.Metadata = metadata; // x-amz-meta-*
  await s3.send(new PutObjectCommand(params));
}

function getR2BucketName() {
  if (process.env.R2_BUCKET_NAME) return process.env.R2_BUCKET_NAME;
  // Try to parse wrangler.jsonc for bucket_name
  try {
    const cfg = fs.readFileSync(path.join(process.cwd(), 'wrangler.jsonc'), 'utf8');
    const m = cfg.match(/"bucket_name"\s*:\s*"([^"]+)"/);
    if (m) return m[1];
  } catch {}
  // Fallback: known default bucket
  return 'dhugs-assets';
}

function parseArgs() {
  const out = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
  const hasValue = process.argv[i + 1] && !process.argv[i + 1].startsWith('--');
  const v = hasValue ? process.argv[++i] : '';
    out[k] = v;
  }
  return out;
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function yyyymmFrom(dateStr) {
  const parts = String(dateStr).trim().split(/\s+/);
  const head = parts[0]; // YYYY-MM-DD or ISO
  const d = new Date(head.includes('T') ? head : (head + 'T00:00:00Z'));
  if (isNaN(d.getTime())) throw new Error('Invalid date: ' + dateStr);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return { year: String(y), month: m };
}

async function uploadAvifsToR2(dir, prefix) {
  const bucket = getR2BucketName();
  const entries = fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.avif'))
    .filter(f => !f.startsWith('.')) // ignore dotfiles like ._thumbnail.avif
    .filter(f => f.toLowerCase() !== 'thumbnail.avif'); // don't upload album thumbnail
  if (!entries.length) throw new Error('No .avif files found in ' + dir);
  console.log(`Uploading ${entries.length} AVIF(s) to r2://${prefix}/`);
  for (const f of entries) {
    const key = `${prefix}/${f}`;
    const full = path.join(dir, f);
    let w = 0, h = 0;
    try { const info = await sharp(full).metadata(); w = info.width || 0; h = info.height || 0; } catch {}
    await s3PutFile(bucket, key, full, 'image/avif', w && h ? { width: String(w), height: String(h) } : undefined);
  }
  return entries;
}

async function uploadThumbnail(dir, entries, destThumbKey, chosenOrPath) {
  // Accept absolute path or select from entries
  const absProvided = chosenOrPath && path.isAbsolute(chosenOrPath) && fs.existsSync(chosenOrPath);
  const file = absProvided ? path.basename(chosenOrPath) : (chosenOrPath && entries.includes(chosenOrPath) ? chosenOrPath : entries[0]);
  console.log('Preparing thumbnail from', file);
  // Crop to largest possible exact 3:2 without resizing (no up/downscale).
  const srcPathAvif = absProvided ? chosenOrPath : path.join(dir, file);
  // Prefer sibling JPG folder as source if available to avoid AVIF decode hiccups
  const base = file.replace(/\.avif$/i,'');
  const jpgDirGuess = dir.endsWith(' Avif') ? dir.replace(/ Avif$/,' JPG') : path.join(path.dirname(dir), path.basename(dir).replace(/Avif$/,'JPG'));
  const jpgCandidate = path.join(jpgDirGuess, base + '.jpg');
  const sourcePath = fs.existsSync(jpgCandidate) ? jpgCandidate : srcPathAvif;

  const meta = await sharp(sourcePath).rotate().metadata();
  const ow = meta.width || 0;
  const oh = meta.height || 0;
  if (!ow || !oh) throw new Error('Unable to read image dimensions for ' + srcPath);
  // Compute largest 3:2 rectangle inside original dims
  const targetHFromW = Math.floor((ow * 2) / 3);
  let cw, ch;
  if (targetHFromW <= oh) {
    cw = ow; ch = targetHFromW;
  } else {
    ch = oh; cw = Math.floor((oh * 3) / 2);
  }
  const left = Math.floor((ow - cw) / 2);
  const top = Math.floor((oh - ch) / 2);

  const tmpOut = path.join(process.cwd(), `.thumb-${Date.now()}.avif`);
  try {
    await sharp(sourcePath)
      .rotate()
      .extract({ left, top, width: cw, height: ch })
      .toFormat('avif', { quality: 60 })
      .toFile(tmpOut);
  } catch (e) {
    // Fallback: ImageMagick crop if Sharp fails to decode
    await execa('magick', [sourcePath, '-gravity','center','-crop', `${cw}x${ch}+${left}+${top}`, '+repage', tmpOut], { stdio: 'inherit' });
  }
  const outMeta = await sharp(tmpOut).metadata();
  const tw = outMeta.width || cw;
  const th = outMeta.height || ch;
  console.log('Uploading thumbnail ->', destThumbKey, `(${tw}x${th})`);
  const bucket = getR2BucketName();
  await s3PutFile(bucket, destThumbKey, tmpOut, 'image/avif', { width: String(tw), height: String(th) });
  // Generate responsive variants (s/m/l) for the thumbnail too
  try {
    for (const [short, widthTarget] of Object.entries(RESPONSIVE_SIZES)) {
      const variantKey = destThumbKey.replace(/^o\//, `${short}/`); // o/albums/.. -> s/albums/..
      const tmpVar = path.join(process.cwd(), `.thumb-${short}-${Date.now()}-${Math.random().toString(36).slice(2)}.avif`);
      try {
        await sharp(tmpOut).resize(widthTarget).toFormat('avif', { quality: 60 }).toFile(tmpVar);
      } catch (e) {
        // Fallback to ImageMagick if Sharp fails
        await execa('magick', [tmpOut, '-auto-orient', '-resize', `${widthTarget}`, tmpVar], { stdio: 'inherit' });
      }
      try {
        let vw = 0, vh = 0;
        try { const info = await sharp(tmpVar).metadata(); vw = info.width || 0; vh = info.height || 0; } catch {}
        await s3PutFile(bucket, variantKey, tmpVar, 'image/avif', vw && vh ? { width: String(vw), height: String(vh) } : undefined);
        console.log('Uploaded thumbnail variant ->', variantKey, `(${vw || '?'}x${vh || '?'})`);
      } finally { try { fs.unlinkSync(tmpVar); } catch {} }
    }
  } catch (e) {
    console.warn('Warning: failed generating responsive thumbnail variants:', e.message);
  }
  try { fs.unlinkSync(tmpOut); } catch {}
  return file;
}

async function generateResponsiveSizes(avifDir, uploaded, albumRoot) {
  const bucket = getR2BucketName();
  // Try to find a sibling JPG directory to avoid decoding AVIF
  const avifBase = path.basename(avifDir);
  const jpgSiblingCandidates = [
    path.join(path.dirname(avifDir), avifBase.replace(/Avif$/i, 'JPG')),
    path.join(path.dirname(avifDir), avifBase.replace(/Avif$/i, 'Jpg')),
    path.join(path.dirname(avifDir), avifBase.replace(/Avif$/i, ' jpg')),
  ];
  const jpgDir = jpgSiblingCandidates.find(p => { try { return fs.existsSync(p) && fs.statSync(p).isDirectory(); } catch { return false; } }) || null;

  for (const f of uploaded) {
    const avifPath = path.join(avifDir, f);
    const base = f.replace(/\.avif$/i,'');
    const jpgPath = jpgDir ? [
      path.join(jpgDir, base + '.jpg'),
      path.join(jpgDir, base + '.JPG'),
      path.join(jpgDir, base + '.jpeg'),
      path.join(jpgDir, base + '.JPEG'),
      path.join(jpgDir, base + '.png'),
      path.join(jpgDir, base + '.PNG'),
    ].find(p => fs.existsSync(p)) : null;
    const source = jpgPath || avifPath;

    const baseKey = `${albumRoot}/images/${f}`; // o/albums/.../images/file
  for (const [short, width] of Object.entries(RESPONSIVE_SIZES)) {
      const key = baseKey.replace(/^o\//, `${short}/`);
      const tmp = path.join(process.cwd(), `.img-${short}-${Date.now()}-${Math.random().toString(36).slice(2)}.avif`);
      try {
        await sharp(source).rotate().resize(width).toFormat('avif', { quality: 60 }).toFile(tmp);
      } catch (e) {
        // Fallback to ImageMagick if Sharp fails (e.g., AVIF decode)
        await execa('magick', [source, '-auto-orient', '-resize', `${width}`, tmp], { stdio: 'inherit' });
      }
      try {
        let w = 0, h = 0;
        try { const info = await sharp(tmp).metadata(); w = info.width || 0; h = info.height || 0; } catch {}
        await s3PutFile(bucket, key, tmp, 'image/avif', w && h ? { width: String(w), height: String(h) } : undefined);
      } finally { try { fs.unlinkSync(tmp); } catch {} }
    }
  }
}

// images/_meta.json generation removed; metadata is written per-object.

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(res => rl.question(question, (x) => res(x)));
  rl.close();
  return answer.trim();
}

async function main() {
  const args = parseArgs();
  // Interactive prompts for missing fields
  if (!args.dir) args.dir = await prompt('Path to album folder (contains "Avif" and optional thumbnail.avif): ');
  if (!args.title) args.title = await prompt('Album title: ');
  if (!args.date) args.date = await prompt('Date (YYYY-MM-DD Timezone or ISO TZ): ');
  if (!args.author) args.author = await prompt('Author: ');
  if (!args.tags) args.tags = await prompt('Tags (comma separated, optional): ');
  if (!args.width) args.width = await prompt('Width (small|medium|large, default large): ');
  if (args.download_url === undefined) {
    args.download_url = await prompt('Download URL (optional, leave blank for none): ');
  }
  if (!args.slug) args.slug = slugify(args.title);

  const title = args.title;
  const author = args.author;
  const date = args.date; // "YYYY-MM-DD Timezone" or ISO + Timezone
  const width = args.width || 'large';
  const tags = args.tags || '';
  const downloadUrl = args.download_url ? args.download_url.trim() : '';
  const slug = args.slug || slugify(title);
  const { year, month } = yyyymmFrom(date);
  const albumDir = path.resolve(args.dir);
  if (!fs.existsSync(albumDir)) throw new Error('Directory not found: ' + albumDir);
  // Find AVIF images folder inside albumDir
  function findAvifDir(root) {
    const entries = fs.readdirSync(root);
    const subdirs = entries
      .filter(n => !n.startsWith('.'))
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
  const avifDir = findAvifDir(albumDir);
  if (!avifDir) throw new Error('Could not find an AVIF folder inside: ' + albumDir);

  const albumRoot = `o/albums/${year}/${month}/${slug}`;
  const imagesPrefix = `${albumRoot}/images`;

  console.log('Detected AVIF folder:', avifDir);
  // 1) Upload images from AVIF directory
  const uploaded = await uploadAvifsToR2(avifDir, imagesPrefix);

  // Ask which thumbnail to use if not provided
  if (!args.thumb) {
    // If albumDir/thumbnail.avif exists, prefer it
    const candidates = ['thumbnail.avif','Thumbnail.avif','THUMBNAIL.AVIF'];
    const preThumb = candidates.map(n => path.join(albumDir,n)).find(p => fs.existsSync(p));
    if (preThumb) args.thumb = preThumb; // pass absolute
  }
  if (!args.thumb) {
    console.log('\nSelect thumbnail by index:');
    uploaded.forEach((f, i) => console.log(`${i + 1}. ${f}`));
    const idxStr = await prompt('Thumbnail index (1..n, default 1): ');
    const idx = Math.max(1, Math.min(uploaded.length, parseInt(idxStr || '1', 10) || 1));
    args.thumb = uploaded[idx - 1];
  }

  // 2) Upload thumbnail
  const thumbKey = `${albumRoot}/thumbnail.avif`;
  const chosenThumb = await uploadThumbnail(avifDir, uploaded, thumbKey, args.thumb);
  console.log(`Uploaded ${uploaded.length} image(s) and thumbnail: ${chosenThumb}`);

  // 3) Generate responsive sizes only for this album (s/m/l)
  await generateResponsiveSizes(avifDir, uploaded, albumRoot);

  // 4) Skip images/_meta.json; dimensions are embedded in object metadata

  // 5) Upsert album row in D1 (with CDN thumbnail URL)
  const cdn = process.env.CDN_SITE || '';
  const thumbnailUrl = cdn ? `${cdn}/${albumRoot}/thumbnail.avif` : null;

  // 5) Upsert album row in D1 without tsx
  function esc(v) { return v == null || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`; }
  function dateIsoForUpsert(dateField) {
    const parts = String(dateField).trim().split(/\s+/);
    const head = parts[0];
    const tz = parts.slice(1).join(' ') || 'UTC';
    const d = new Date(head.includes('T') ? head : (head + 'T00:00:00Z'));
    if (isNaN(d.getTime())) throw new Error('Invalid date: ' + dateField);
    return { iso: d.toISOString(), tz };
  }
  const { iso, tz } = dateIsoForUpsert(date);
  // Compute DB path: YYYY/MM/slug (UTC parts from ISO)
  const d = new Date(iso);
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2,'0');
  const pathSeg = `${yyyy}/${mm}/${slug}`;
  const binding = process.env.D1_BINDING || 'D1_POSTS';
  const insert = `INSERT INTO posts (path,slug,type,title,author,excerpt,content,date_utc,timezone,width,thumbnail,download_url)
    VALUES (
      ${esc(pathSeg)},
      ${esc(slug)},
      'album',
      ${esc(title)},
      ${esc(author)},
      NULL,
      '',
      ${esc(iso)},
      ${esc(tz)},
      ${esc(width || 'large')},
      ${esc(thumbnailUrl)},
      ${esc(downloadUrl || null)}
    ) ON CONFLICT(path) DO UPDATE SET title=excluded.title,author=excluded.author,excerpt=excluded.excerpt,date_utc=excluded.date_utc,timezone=excluded.timezone,width=excluded.width,thumbnail=excluded.thumbnail,download_url=excluded.download_url;`;
  const tagStmts = [];
  for (const t of String(tags||'').split(/[,;]+/).map(s=>s.trim()).filter(Boolean)) {
    const safe = t.replace(/'/g, "''");
    tagStmts.push(`INSERT INTO tags (name) VALUES ('${safe}') ON CONFLICT(name) DO NOTHING;`);
    tagStmts.push(`INSERT INTO post_tags (post_id, tag_id) SELECT p.id, tg.id FROM posts p, tags tg WHERE p.path=${esc(pathSeg)} AND tg.name='${safe}' ON CONFLICT(post_id, tag_id) DO NOTHING;`);
  }
  const sql = [insert, ...tagStmts].join('\n');
  const execArgs = ['wrangler','d1','execute',binding,'--command',sql];
  const envName = process.env.CF_ENV || 'prod';
  execArgs.push('--remote','--env', envName);
  await execa('npx', execArgs, { stdio: 'inherit' });

  console.log('\nAlbum published successfully!');
  console.log('- Album prefix:', imagesPrefix);
  console.log('- Thumbnail file:', chosenThumb);
  console.log('- Slug:', slug);
}

main().catch(err => { console.error(err); process.exit(1); });
