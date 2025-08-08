import { S3Client, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";

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

// Configure S3 client for Cloudflare R2.
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.S3_ENDPOINT,
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  } : undefined
});

// Fetch album images from S3 and retrieve metadata if available.
const albumCache = new Map<string, AlbumImage[]>();
export async function getAlbumImages(albumName: string, force = false): Promise<AlbumImage[]> {
  if (!bucket) return [];
  if (!force && albumCache.has(albumName)) return albumCache.get(albumName)!;
  const prefix = albumName.endsWith("/") ? albumName : albumName + "/";
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
  });
  let response;
  try {
    response = await s3.send(command);
  } catch (e) {
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
          const headData = await s3.send(head);
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
