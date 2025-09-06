// Publish or update the site's main thumbnail to R2/CDN in s/m/l/o tiers
// Usage:
//   node scripts/publish-home-thumbnail.js --file ./thumbnail.avif
//   node scripts/publish-home-thumbnail.js --file ./photo.jpg
//
// Outputs:
//   o/thumbnail.avif
//   s/thumbnail.avif (320w)
//   m/thumbnail.avif (640w)
//   l/thumbnail.avif (1280w)

const fs = require('fs');
const path = require('path');
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

async function s3PutFile(bucket, key, filePath, contentType) {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const s3 = await getS3Client();
  const Body = fs.createReadStream(filePath);
  const params = { Bucket: bucket, Key: key, Body, ContentType: contentType };
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
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const v = process.argv[i+1] && !process.argv[i+1].startsWith('--') ? process.argv[++i] : '';
    out[k] = v;
  }
  return out;
}

function findSiblingRaster(absPath) {
  const dir = path.dirname(absPath);
  const base = path.basename(absPath).replace(/\.[^.]+$/i, '');
  const candidates = [
    path.join(dir, base + '.jpg'),
    path.join(dir, base + '.JPG'),
    path.join(dir, base + '.jpeg'),
    path.join(dir, base + '.JPEG'),
    path.join(dir, base + '.png'),
    path.join(dir, base + '.PNG'),
  ];
  for (const p of candidates) { try { if (fs.existsSync(p)) return p; } catch {} }
  // If folder ends with Avif/ AVIF/, try sibling JPG folder
  const dname = path.basename(dir);
  const parent = path.dirname(dir);
  const siblingNames = [dname.replace(/\bAvif\b/i, 'JPG'), dname.replace(/\bAvif\b/i, 'Jpg'), dname.replace(/\bAvif\b/i, ' jpg')];
  for (const sib of siblingNames) {
    if (!sib || sib === dname) continue;
    const sdir = path.join(parent, sib);
    const scands = [
      path.join(sdir, base + '.jpg'),
      path.join(sdir, base + '.JPG'),
      path.join(sdir, base + '.jpeg'),
      path.join(sdir, base + '.JPEG'),
      path.join(sdir, base + '.png'),
      path.join(sdir, base + '.PNG'),
    ];
    for (const p of scands) { try { if (fs.existsSync(p)) return p; } catch {} }
  }
  return null;
}

async function main() {
  const args = parseArgs();
  const file = args.file || args.f;
  if (!file) {
    console.error('Usage: node scripts/publish-home-thumbnail.js --file <image.(avif|jpg|jpeg|png)>' );
    process.exit(1);
  }
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) {
    console.error('File not found:', abs);
    process.exit(1);
  }

  const bucket = getR2BucketName();
  const ext = path.extname(abs).toLowerCase();

  // 1) Upload original as AVIF to o/thumbnail.avif
  const originalTmp = path.join(process.cwd(), `.home-thumb-o-${Date.now()}.avif`);
  try {
    if (ext === '.avif') {
      // Copy file to tmp to ensure consistent upload
      fs.copyFileSync(abs, originalTmp);
    } else {
      await sharp(abs).rotate().toFormat('avif').toFile(originalTmp);
    }
    await s3PutFile(bucket, 'o/thumbnail.avif', originalTmp, 'image/avif');
    console.log('Uploaded: o/thumbnail.avif');
  } finally {
    try { fs.unlinkSync(originalTmp); } catch {}
  }

  // 2) Generate s/m/l tiers, handling AVIF decode edge cases
  let resizeSrc = abs;
  let canDecode = true;
  try {
    await sharp(resizeSrc).metadata();
  } catch {
    canDecode = false;
  }
  if (ext === '.avif' && !canDecode) {
    const sib = findSiblingRaster(abs);
    if (sib) {
      resizeSrc = sib;
      canDecode = true;
      console.log('Using sibling raster for resizing:', sib);
    }
  }

  if (!canDecode) {
    console.warn('Warning: could not decode input for resizing; copying original AVIF to s/m/l.');
    const copySrc = abs; // already AVIF
    for (const tier of Object.keys(RESPONSIVE_SIZES)) {
      await s3PutFile(bucket, `${tier}/thumbnail.avif`, copySrc, 'image/avif');
      console.log(`Uploaded (copy): ${tier}/thumbnail.avif`);
    }
  } else {
    for (const [tier, width] of Object.entries(RESPONSIVE_SIZES)) {
      const tmp = path.join(process.cwd(), `.home-thumb-${tier}-${Date.now()}-${Math.random().toString(36).slice(2)}.avif`);
      try {
        await sharp(resizeSrc).rotate().resize({ width: Number(width) }).toFormat('avif').toFile(tmp);
        await s3PutFile(bucket, `${tier}/thumbnail.avif`, tmp, 'image/avif');
        console.log(`Uploaded: ${tier}/thumbnail.avif`);
      } finally {
        try { fs.unlinkSync(tmp); } catch {}
      }
    }
  }

  console.log('\nDone. Homepage thumbnail now available at:');
  console.log('- s: https://<CDN_SITE>/s/thumbnail.avif');
  console.log('- m: https://<CDN_SITE>/m/thumbnail.avif');
  console.log('- l: https://<CDN_SITE>/l/thumbnail.avif');
  console.log('- o: https://<CDN_SITE>/o/thumbnail.avif');
}

main().catch(err => { console.error(err); process.exit(1); });
