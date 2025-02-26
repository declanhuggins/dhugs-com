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

// Configure S3 client for Cloudflare R2
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

export async function getAlbumImages(albumName: string): Promise<AlbumImage[]> {
  const prefix = albumName.endsWith("/") ? albumName : albumName + "/";
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
  });
  const response = await s3.send(command);
  const objects = response.Contents || [];

  const images = await Promise.all(
    objects
      .filter(obj => {
        if (!obj.Key) return false;
        const ext = obj.Key.slice(obj.Key.lastIndexOf(".")).toLowerCase();
        return allowedExtensions.includes(ext);
      })
      .map(async obj => {
        const key = obj.Key!;
        // Default fallback dimensions
        let width = 1600, height = 900;
        try {
          const head = new HeadObjectCommand({ Bucket: bucket, Key: key });
          const headData = await s3.send(head);
          if (headData.Metadata) {
            // S3 returns metadata keys in lowercase
            if (headData.Metadata.width && headData.Metadata.height) {
              width = parseInt(headData.Metadata.width.trim(), 10);
              height = parseInt(headData.Metadata.height.trim(), 10);
            }
          }
        } catch (err) {
          console.error(`Error fetching metadata for ${key}:`, err);
        }
        const filename = key.replace(prefix, '');
        return {
          filename,
          largeURL: `https://cdn.dhugs.com/${albumName}/${filename}`,
          thumbnailURL: `https://cdn.dhugs.com/${albumName}/${filename}`,
          width,
          height,
          alt: filename,
        } as AlbumImage;
      })
  );
  return images;
}
