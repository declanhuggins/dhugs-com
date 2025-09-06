import 'dotenv/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function getBucketName(): string {
  return process.env.AWS_BUCKET_NAME || process.env.R2_BUCKET_NAME || 'dhugs-assets';
}

async function main() {
  const mode = (process.argv[2] || 'disallow').toLowerCase();
  if (!['disallow', 'allow'].includes(mode)) {
    console.error('Usage: tsx scripts/upload-cdn-robots.ts [disallow|allow]');
    process.exit(2);
  }

  const endpoint = requireEnv('S3_ENDPOINT');
  const region = process.env.AWS_REGION || 'auto';
  // Prefer write-capable credentials if available
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID_WRITE || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY_WRITE || process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Missing credentials: set AWS_ACCESS_KEY_ID_WRITE/AWS_SECRET_ACCESS_KEY_WRITE or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY');
  }
  const bucket = getBucketName();

  const s3 = new S3Client({ region, endpoint, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } });

  const lines: string[] = [];
  lines.push('User-agent: *');
  if (mode === 'disallow') {
    lines.push('Disallow: /');
  } else {
    // Allow crawling; keep path explicit for clarity
    lines.push('Disallow:');
  }
  // No sitemap under CDN host; canonical sitemap is under primary domain
  const body = lines.join('\n') + '\n';

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: 'robots.txt',
    Body: body,
    ContentType: 'text/plain; charset=utf-8',
    CacheControl: 'public, max-age=3600',
  }));
  console.log(`Uploaded robots.txt to r2://${bucket}/robots.txt (${mode})`);
  console.log('URL: https://cdn.dhugs.com/robots.txt');
}

main().catch(err => { console.error(err); process.exit(1); });
