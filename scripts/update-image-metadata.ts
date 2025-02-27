import { S3Client, ListObjectsV2Command, GetObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import dotenv from "dotenv";

dotenv.config({ path: '.env.local' });

const bucketName = process.env.AWS_BUCKET_NAME;
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID_WRITE!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_WRITE!
  }
});

async function updateImageMetadata() {
  const listCommand = new ListObjectsV2Command({
    Bucket: bucketName
  });
  const listResponse = await s3.send(listCommand);
  const objects = listResponse.Contents || [];

  for (const obj of objects) {
    const key = obj.Key!;
    console.log(`Processing: ${key}`);

    try {
      // Fetch the object
      const getCommand = new GetObjectCommand({ Bucket: bucketName, Key: key });
      const getResponse = await s3.send(getCommand);
      const data = await streamToBuffer(getResponse.Body as NodeJS.ReadableStream);

      // Open image from memory and get dimensions
      const image = sharp(data);
      const metadata = await image.metadata();
      const width = metadata.width;
      const height = metadata.height;
      console.log(`Dimensions for ${key}: ${width}x${height}`);

      // Prepare new metadata
      const newMetadata = {
        width: width?.toString() || '',
        height: height?.toString() || ''
      };

      // Copy the object to itself with new metadata
      const copySource = `${bucketName}/${key}`;
      const copyCommand = new CopyObjectCommand({
        Bucket: bucketName,
        CopySource: copySource,
        Key: key,
        Metadata: newMetadata,
        MetadataDirective: 'REPLACE'
      });
      await s3.send(copyCommand);
      console.log(`Updated metadata for ${key}`);
    } catch (err) {
      console.error(`Skipping ${key} (not a valid image): ${err}`);
      continue;
    }
  }
}

// Helper: convert NodeJS stream to Buffer.
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

updateImageMetadata()
  .then(() => console.log("Done updating image metadata."))
  .catch(err => {
    console.error("Error:", err);
    process.exit(1);
  });
