import './env-init.ts';
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { promisify } from "util";
import { exec } from "child_process";

const execPromise = promisify(exec);

const allowedExtensions = [".jpg", ".jpeg", ".png", ".avif"];
const bucket = process.env.AWS_BUCKET_NAME;
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID_WRITE!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_WRITE!
  }
});

// Helper: convert NodeJS stream to Buffer.
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
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
  try {
    const headCommand = new HeadObjectCommand({ Bucket: bucket, Key: key });
    await s3.send(headCommand);
    return true;
  } catch (err) {
    if ((err as any).name === 'NotFound') {
      return false;
    }
    throw err;
  }
}

async function processAlbum(albumName: string) {
  const prefix = albumName.endsWith("/") ? albumName : albumName + "/";
  const listCommand = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix
  });
  const listResponse = await s3.send(listCommand);
  const objects = listResponse.Contents || [];
  
  const imageObjects = objects.filter(obj => {
    if (!obj.Key) return false;
    const ext = obj.Key.slice(obj.Key.lastIndexOf(".")).toLowerCase();
    const isNotInExcludedFolders = !obj.Key.startsWith('small/') && !obj.Key.startsWith('medium/') && !obj.Key.startsWith('large/');
    return allowedExtensions.includes(ext) && isNotInExcludedFolders;
  });

  for (const obj of imageObjects) {
    const key = obj.Key!;
    console.log(`Processing: ${key}`);
    try {
      // Check if resized images already exist
      const smallKey = `small/${key}`;
      const mediumKey = `medium/${key}`;
      const largeKey = `large/${key}`;

      const smallExists = await imageExists(smallKey);
      const mediumExists = await imageExists(mediumKey);
      const largeExists = await imageExists(largeKey);

      if (smallExists && mediumExists && largeExists) {
        console.log(`Skipping ${key} as resized versions already exist.`);
        continue;
      }

      // Download image
      const getObj = new GetObjectCommand({ Bucket: bucket, Key: key });
      const getResponse = await s3.send(getObj);
      if (!getResponse.Body) continue;
      const buffer = await streamToBuffer(getResponse.Body as NodeJS.ReadableStream);

      // Derive folder and filename.
      const lastSlash = key.lastIndexOf("/");
      const folder = key.substring(0, lastSlash);
      const filename = key.substring(lastSlash + 1);

      // Process and upload for each size.
      for (const [sizeName, width] of Object.entries(sizes)) {
        try {
          const resizedBuffer = await resizeImage(buffer, width);
          const newKey = `${sizeName}/${folder}/${filename}`;
          const putCommand = new PutObjectCommand({
            Bucket: bucket,
            Key: newKey,
            Body: resizedBuffer,
            ContentType: "image/avif"
          });
          await s3.send(putCommand);
          console.log(`Uploaded ${sizeName} version to ${newKey}`);
        } catch (resizeError) {
          console.error(`Error resizing ${key} to ${sizeName}:`, resizeError);
        }
      }

      // Process and upload thumbnail for each size.
      if (filename === "thumbnail.avif") {
        // Remove any leading 'albums/' or 'images/albums/' from folder for correct path
        let albumFolder = folder.replace(/^images\//, '').replace(/^albums\//, '');
        for (const [sizeName, width] of Object.entries(sizes)) {
          try {
            const resizedBuffer = await resizeImage(buffer, width);
            const newKey = `${sizeName}/albums/${albumFolder}/thumbnail.avif`;
            const putCommand = new PutObjectCommand({
              Bucket: bucket,
              Key: newKey,
              Body: resizedBuffer,
              ContentType: "image/avif"
            });
            await s3.send(putCommand);
            console.log(`Uploaded ${sizeName} thumbnail to ${newKey}`);
          } catch (resizeError) {
            console.error(`Error resizing thumbnail ${key} to ${sizeName}:`, resizeError);
          }
        }
      }
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
