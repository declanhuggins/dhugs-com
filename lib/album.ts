import { S3Client, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
// Precompiled album images (optional)
let precompiledAlbumImages: Record<string, { filename: string; width: number; height: number; alt: string; largeURL: string; thumbnailURL: string; }[]> = {};
try {
  // Attempt dynamic import (will be bundled if exists)
  precompiledAlbumImages = (await import('../data/album-images.json')) as unknown as typeof precompiledAlbumImages;
} catch {
  try {
    precompiledAlbumImages = (Function('try{return require("../data/album-images.json");}catch{return {}}'))();
  } catch { precompiledAlbumImages = {}; }
}

export interface AlbumImage {
  filename: string;
  largeURL: string;
  thumbnailURL: string;
  width: number;
  height: number;
  alt: string;
}

const allowedExtensions = [".jpg", ".jpeg", ".png", ".avif"];
const bucket = process.env.AWS_BUCKET_NAME;
if (!bucket) {
  console.warn('AWS_BUCKET_NAME not set; getAlbumImages will return empty array.');
}

// Configure S3 client for Cloudflare R2 if Node fs APIs exist; skip in edge worker to avoid fs.* calls by credential chain.
let s3: S3Client | null = null;
// Heuristic: if process.versions and not in Cloudflare worker runtime (no global Edge constraints), treat as Node.
const nodeLike = typeof process !== 'undefined' && !!process.versions?.node;
const s3Enabled = process.env.ENABLE_S3 === 'true';
if (nodeLike && s3Enabled) {
  s3 = new S3Client({
    region: process.env.AWS_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
    } : undefined,
  });
} else if (typeof console !== 'undefined' && process?.env?.NODE_ENV !== 'production') {
  console.warn('[album] S3 disabled (runtime not Node or ENABLE_S3 not true); album images omitted.');
}

// Fetch album images from S3 and retrieve metadata if available.
const albumCache = new Map<string, AlbumImage[]>();
export async function getAlbumImages(albumName: string, force = false): Promise<AlbumImage[]> {
  // 1. Edge fallback: use precompiled data immediately when S3 disabled.
  if (!s3) {
    return precompiledAlbumImages[albumName] || [];
  }
  if (!bucket) return [];
  if (!force && albumCache.has(albumName)) return albumCache.get(albumName)!;
  const prefix = albumName.endsWith("/") ? albumName : albumName + "/";
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
  });
  const client = s3; // non-null local reference
  let response;
  try {
  response = await client!.send(command);
  } catch (e: unknown) {
    // If the error is due to fs not implemented (edge), disable s3 for remainder of session.
    const hasMessage = (val: unknown): val is { message: string } =>
      typeof val === 'object' && val !== null && 'message' in val && typeof (val as { message: unknown }).message === 'string';
    if (hasMessage(e) && e.message.includes('fs.readFile')) {
      if (typeof console !== 'undefined') console.warn('[album] Disabling S3 in edge runtime after fs error.');
      s3 = null;
      return [];
    }
    console.error('Error listing objects for album', albumName, e);
    return [];
  }
  const objects = response.Contents || [];

  const images = await Promise.all(
    objects.filter(obj => {
        if (!obj.Key) return false;
        const ext = obj.Key.slice(obj.Key.lastIndexOf(".")).toLowerCase();
        return allowedExtensions.includes(ext);
      }).map(async obj => {
        const key = obj.Key!;
        let width = 1600, height = 900;
        try {
          const head = new HeadObjectCommand({ Bucket: bucket, Key: key });
          const headData = await client!.send(head);
          if (headData.Metadata && headData.Metadata.width && headData.Metadata.height) {
            width = parseInt(headData.Metadata.width.trim(), 10);
            height = parseInt(headData.Metadata.height.trim(), 10);
          }
        } catch (err) {
          console.error(`Error fetching metadata for ${key}:`, err);
        }
        const filename = key.replace(prefix, '');
        return {
          filename,
          largeURL: `${process.env.CDN_SITE}/${albumName}/${filename}`,
          thumbnailURL: `${process.env.CDN_SITE}/${albumName}/${filename}`,
          width,
          height,
          alt: filename,
        } as AlbumImage;
      })
  );
  albumCache.set(albumName, images);
  return images;
}
