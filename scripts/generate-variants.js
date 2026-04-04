#!/usr/bin/env node
// generate-variants.js - Generate responsive variants and thumbnails for albums.
//
// Image variant mode (per-image, called in a loop by the plugin):
//   node generate-variants.js --file /path/to/image.avif \
//     --album 2026/01/slug --safe-name sanitized-name.avif \
//     --api-url URL --api-token TOKEN
//
// Thumbnail mode (called once per album):
//   node generate-variants.js --thumb /path/to/image.avif \
//     --album 2026/01/slug \
//     --api-url URL --api-token TOKEN

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { parseArgs } = require('node:util');

const SIZES = { s: 320, m: 640, l: 1280 };

let args;

// Support --args-file for passing arguments via JSON file (avoids shell escaping)
const rawArgs = process.argv.slice(2);
const argsFileIdx = rawArgs.indexOf('--args-file');
if (argsFileIdx !== -1 && rawArgs[argsFileIdx + 1]) {
  const argsJson = JSON.parse(fs.readFileSync(rawArgs[argsFileIdx + 1], 'utf8'));
  args = argsJson;
} else {
  const parsed = parseArgs({
    options: {
      file:              { type: 'string' },
      thumb:             { type: 'string' },
      album:             { type: 'string' },
      'safe-name':       { type: 'string' },
      'api-url':         { type: 'string' },
      'api-token':       { type: 'string' },
      'upload-original': { type: 'boolean', default: false },
    },
  });
  args = parsed.values;
}

const albumPath = args.album;
const apiUrl = args['api-url'];
const apiToken = args['api-token'];

if (!albumPath || !apiUrl || !apiToken) {
  console.error('Required: --album YYYY/MM/slug --api-url URL --api-token TOKEN');
  process.exit(1);
}

async function upload(buffer, r2Key, contentType, width, height) {
  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: contentType }), path.basename(r2Key));
  formData.append('key', r2Key);
  if (width) formData.append('file_width', String(width));
  if (height) formData.append('file_height', String(height));

  const resp = await fetch(`${apiUrl}/api/admin/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiToken}` },
    body: formData,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Upload ${r2Key}: HTTP ${resp.status} ${text}`);
  }
}

// Generate s/m/l AVIF variants for a single image.
// If --upload-original is set, also convert the source to AVIF and upload to /o/.
async function generateImageVariants(filePath, safeName, uploadOriginal) {
  // Ensure safeName ends in .avif
  const avifName = safeName.replace(/\.[^.]+$/, '.avif');

  // Upload high-quality AVIF original to /o/
  if (uploadOriginal) {
    const oKey = `o/${albumPath}/images/${avifName}`;
    try {
      const original = await sharp(filePath)
        .rotate()
        .toFormat('avif', { quality: 80 })
        .toBuffer();
      const meta = await sharp(original).metadata();
      await upload(original, oKey, 'image/avif', meta.width, meta.height);
      console.log(`Uploaded ${oKey} (${meta.width}x${meta.height})`);
    } catch (e) {
      console.error(`Failed ${oKey}:`, e.message);
      process.exitCode = 1;
    }
  }

  // Generate s/m/l resized variants
  for (const [prefix, width] of Object.entries(SIZES)) {
    const r2Key = `${prefix}/${albumPath}/images/${avifName}`;
    try {
      const resized = await sharp(filePath)
        .rotate()
        .resize(width)
        .toFormat('avif', { quality: 60 })
        .toBuffer();
      const meta = await sharp(resized).metadata();
      await upload(resized, r2Key, 'image/avif', meta.width, meta.height);
    } catch (e) {
      console.error(`Failed ${r2Key}:`, e.message);
      process.exitCode = 1;
    }
  }
}

// Generate thumbnail: crop to 3:2, produce AVIF + JPG at o/s/m/l
async function generateThumbnail(filePath) {
  const meta = await sharp(filePath).rotate().metadata();
  const ow = meta.width || 0;
  const oh = meta.height || 0;
  if (!ow || !oh) throw new Error('Cannot read dimensions: ' + filePath);

  // Largest 3:2 rectangle that fits inside original
  const targetH = Math.floor((ow * 2) / 3);
  let cw, ch;
  if (targetH <= oh) {
    cw = ow;
    ch = targetH;
  } else {
    ch = oh;
    cw = Math.floor((oh * 3) / 2);
  }
  const left = Math.floor((ow - cw) / 2);
  const top = Math.floor((oh - ch) / 2);

  // Full-size cropped thumbnail (for /o/)
  const croppedAvif = await sharp(filePath)
    .rotate()
    .extract({ left, top, width: cw, height: ch })
    .toFormat('avif', { quality: 60 })
    .toBuffer();
  const croppedJpg = await sharp(filePath)
    .rotate()
    .extract({ left, top, width: cw, height: ch })
    .jpeg({ quality: 88, progressive: true })
    .toBuffer();

  const avifMeta = await sharp(croppedAvif).metadata();
  const tw = avifMeta.width || cw;
  const th = avifMeta.height || ch;

  // Upload original-size thumbnail
  await upload(croppedAvif, `o/${albumPath}/thumbnail.avif`, 'image/avif', tw, th);
  await upload(croppedJpg, `o/${albumPath}/thumbnail.jpg`, 'image/jpeg', tw, th);
  console.log(`Uploaded o/ thumbnail (${tw}x${th})`);

  // Generate and upload s/m/l variants of the thumbnail
  for (const [prefix, targetWidth] of Object.entries(SIZES)) {
    try {
      const sizedAvif = await sharp(croppedAvif)
        .resize(targetWidth)
        .toFormat('avif', { quality: 60 })
        .toBuffer();
      const sizedJpg = await sharp(croppedJpg)
        .resize(targetWidth)
        .jpeg({ quality: 88, progressive: true })
        .toBuffer();

      const sm = await sharp(sizedAvif).metadata();
      const sw = sm.width || targetWidth;
      const sh = sm.height || 0;

      await upload(sizedAvif, `${prefix}/${albumPath}/thumbnail.avif`, 'image/avif', sw, sh);
      await upload(sizedJpg, `${prefix}/${albumPath}/thumbnail.jpg`, 'image/jpeg', sw, sh);
      console.log(`Uploaded ${prefix}/ thumbnail (${sw}x${sh})`);
    } catch (e) {
      console.error(`Failed ${prefix}/ thumbnail:`, e.message);
      process.exitCode = 1;
    }
  }
}

async function main() {
  if (args.thumb) {
    await generateThumbnail(args.thumb);
    return;
  }

  if (args.file) {
    const safeName = args['safe-name'] || path.basename(args.file);
    await generateImageVariants(args.file, safeName, args['upload-original']);
    return;
  }

  console.error('Provide --file or --thumb');
  process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
