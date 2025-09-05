import { promisify } from "util";
import { exec } from "child_process";
import { execa } from "execa";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

require('dotenv').config({ quiet: true });

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: (process.env.AWS_ACCESS_KEY_ID_WRITE || process.env.AWS_ACCESS_KEY_ID) ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID_WRITE || process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_WRITE || process.env.AWS_SECRET_ACCESS_KEY!,
  } : undefined,
});

const execPromise = promisify(exec);

const allowedExtensions = [".jpg", ".jpeg", ".png", ".avif"];

function getR2BucketName(): string {
  if (process.env.R2_BUCKET_NAME) return process.env.R2_BUCKET_NAME;
  try {
    const cfg = fs.readFileSync(path.join(process.cwd(), 'wrangler.jsonc'), 'utf8');
    const m = cfg.match(/"bucket_name"\s*:\s*"([^"]+)"/);
    if (m) return m[1];
  } catch {}
  return 'dhugs-media';
}

async function r2List(prefix: string): Promise<string[]> {
  const bucket = getR2BucketName();
  const envName = process.env.CF_ENV || 'prod';
  const { stdout } = await execa('npx', ['wrangler','r2','object','list', `${bucket}`, '--prefix', prefix, '--json', '--remote','--env', envName], { stdout: 'pipe' });
  const parsed = JSON.parse(stdout);
  const items: Array<{ key?: string; name?: string }> = Array.isArray(parsed) ? parsed : (parsed?.objects || parsed?.keys || []);
  return items.map(it => (it.key || it.name) as string).filter(Boolean);
}

async function r2Head(key: string): Promise<boolean> {
  try {
    const bucket = getR2BucketName();
    const envName = process.env.CF_ENV || 'prod';
    await execa('npx', ['wrangler','r2','object','head', `${bucket}/${key}`, '--remote','--env', envName]);
    return true;
  } catch { return false; }
}

async function r2GetToFile(key: string, filePath: string) {
  const bucket = getR2BucketName();
  const envName = process.env.CF_ENV || 'prod';
  await execa('npx', ['wrangler','r2','object','get', `${bucket}/${key}`, '--file', filePath, '--remote','--env', envName], { stdio: 'inherit' });
}

async function r2PutFromFile(key: string, filePath: string, contentType: string) {
  const bucket = getR2BucketName();
  // derive dimensions for metadata
  let w = 0, h = 0;
  try {
    const { stdout } = await execPromise(`identify -format \"%w %h\" ${filePath}`);
    const [ws,hs] = stdout.trim().split(/\s+/);
    w = parseInt(ws,10) || 0; h = parseInt(hs,10) || 0;
  } catch {}
  const { readFile } = await import('fs/promises');
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: await readFile(filePath),
    ContentType: contentType,
    Metadata: w && h ? { width: String(w), height: String(h) } : undefined,
  }));
}

// Define resizing sizes.
const sizes = {
  small: 320,
  medium: 640,
  large: 1280,
};

// Helper: resize image using ImageMagick.
async function resizeImage(buffer: Buffer, width: number): Promise<Buffer> {
  const { writeFile, readFile, unlink } = await import('fs/promises');
  const inputPath = `/tmp/input-${Date.now()}.avif`;
  const outputPath = `/tmp/output-${Date.now()}.avif`;
  await writeFile(inputPath, buffer);
  await execPromise(`convert ${inputPath} -resize ${width} ${outputPath}`);
  const resizedBuffer = await readFile(outputPath);
  await unlink(inputPath);
  await unlink(outputPath);
  return resizedBuffer;
}

async function imageExists(key: string): Promise<boolean> {
  return r2Head(key);
}

async function processAlbum(albumName: string) {
  const prefix = albumName.endsWith("/") ? albumName : albumName + "/";
  const keys = await r2List(prefix);
  
  const imageObjects = keys.filter(key => {
    const ext = key.slice(key.lastIndexOf(".")).toLowerCase();
    const isOriginal = key.includes('/o/');
    const isSizeVariant = key.includes('/s/') || key.includes('/m/') || key.includes('/l/');
    return allowedExtensions.includes(ext) && isOriginal && !isSizeVariant;
  });

  for (const key of imageObjects) {
    console.log(`Processing: ${key}`);
    try {
      // Check if resized images already exist
      const smallKey = key.replace('/o/','/s/');
      const mediumKey = key.replace('/o/','/m/');
      const largeKey = key.replace('/o/','/l/');

      const smallExists = await imageExists(smallKey);
      const mediumExists = await imageExists(mediumKey);
      const largeExists = await imageExists(largeKey);

      if (smallExists && mediumExists && largeExists) {
        console.log(`Skipping ${key} as resized versions already exist.`);
        continue;
      }

      // Download image to temp file then read buffer
      const tmpIn = `/tmp/original-${Date.now()}-${Math.random().toString(36).slice(2)}.img`;
      await r2GetToFile(key, tmpIn);
      const { readFile, unlink } = await import('fs/promises');
      const buffer = await readFile(tmpIn);

      // Derive folder and filename.
      const lastSlash = key.lastIndexOf("/");
      const folder = key.substring(0, lastSlash);
      const filename = key.substring(lastSlash + 1);

      // Process and upload for each size.
      for (const [sizeName, width] of Object.entries(sizes)) {
        try {
          const resizedBuffer = await resizeImage(buffer, width);
          const sizeShort = sizeName === 'small' ? 's' : sizeName === 'medium' ? 'm' : 'l';
          const newKey = key.replace('/o/','/'+sizeShort+'/');
          const { writeFile, unlink } = await import('fs/promises');
          const tmpOut = `/tmp/${sizeName}-${Date.now()}-${Math.random().toString(36).slice(2)}.avif`;
          await writeFile(tmpOut, resizedBuffer);
          await r2PutFromFile(newKey, tmpOut, 'image/avif');
          await unlink(tmpOut);
          console.log(`Uploaded ${sizeName} version to ${newKey}`);
        } catch (resizeError) {
          console.error(`Error resizing ${key} to ${sizeName}:`, resizeError);
        }
      }

      // Process and upload thumbnail for each size.
      if (filename === "thumbnail.avif") {
        // Compute target thumbnail keys under images/<sizeShort>/albums/.../thumbnail.avif
        let albumFolder = folder.replace(/^o\//, '').replace(/\/images$/, '');
        for (const [sizeName, width] of Object.entries(sizes)) {
          try {
            const resizedBuffer = await resizeImage(buffer, width);
            const sizeShort = sizeName === 'small' ? 's' : sizeName === 'medium' ? 'm' : 'l';
            const newKey = `${sizeShort}/albums/${albumFolder}/thumbnail.avif`;
            const { writeFile, unlink } = await import('fs/promises');
            const tmpOut = `/tmp/${sizeName}-thumb-${Date.now()}-${Math.random().toString(36).slice(2)}.avif`;
            await writeFile(tmpOut, resizedBuffer);
            await r2PutFromFile(newKey, tmpOut, 'image/avif');
            await unlink(tmpOut);
            console.log(`Uploaded ${sizeName} thumbnail to ${newKey}`);
          } catch (resizeError) {
            console.error(`Error resizing thumbnail ${key} to ${sizeName}:`, resizeError);
          }
        }
      }
      await unlink(tmpIn);
    } catch (err) {
      console.error(`Error processing ${key}:`, err);
    }
  }
}

async function processAllAlbums() {
  const directories = ['albums/', 'about/', 'portfolio/', 'thumbnails/'];

  for (const dir of directories) {
    console.log(`Processing directory: ${dir}`);
    await processAlbum(dir);
  }
}

// Accept an album name as an argument and process only that album
if (import.meta.url === `file://${process.argv[1]}`) {
  const albumArg = process.argv[2];
  if (albumArg) {
    processAlbum(albumArg)
      .then(() => console.log(`Done processing album: ${albumArg}`))
      .catch(err => {
        console.error("Error:", err);
        process.exit(1);
      });
  } else {
    processAllAlbums()
      .then(() => console.log("Done processing all albums."))
      .catch(err => {
        console.error("Error:", err);
        process.exit(1);
      });
  }
}
