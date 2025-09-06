import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { S3Client, ListObjectsV2Command, ListObjectsV2CommandOutput, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

type Post = { path?: string; slug: string; content?: string };

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function listAll(s3: S3Client, bucket: string, prefix: string): Promise<string[]> {
  let token: string | undefined = undefined;
  const keys: string[] = [];
  do {
    const out: ListObjectsV2CommandOutput = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
    for (const o of out.Contents || []) if (o.Key) keys.push(o.Key);
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function main() {
  // Load posts to find album paths
  const postsJson = path.join(process.cwd(), 'dist', 'data', 'posts.json');
  const arr = JSON.parse(await fs.readFile(postsJson, 'utf8')) as Post[];
  const albums = arr.filter(p => (p.content ?? '') === '' && p.path).map(p => String(p.path));
  // Always include the special portfolio album
  albums.push('portfolio');
  if (!albums.length) {
    console.log('No albums detected in dist/data/posts.json');
    return;
  }

  const endpoint = requireEnv('S3_ENDPOINT');
  const region = process.env.AWS_REGION || 'auto';
  const accessKeyId = (process.env.AWS_ACCESS_KEY_ID_WRITE || process.env.AWS_ACCESS_KEY_ID)!;
  const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY_WRITE || process.env.AWS_SECRET_ACCESS_KEY)!;
  const bucket = (process.env.AWS_BUCKET_NAME || process.env.R2_BUCKET_NAME) as string;
  const s3 = new S3Client({ region, endpoint, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } });

  const allowed = new Set(['.jpg','.jpeg','.png','.avif']);
  let total = 0;
  for (const p of albums) {
    const imagesPrefix = p === 'portfolio' ? `o/portfolio/images/` : `o/${p}/images/`;
    const keys = (await listAll(s3, bucket, imagesPrefix))
      .filter(k => !k.endsWith('/_manifest.json') && !k.endsWith('/_meta.json'))
      .filter(k => {
        const dot = k.lastIndexOf('.');
        const ext = dot >= 0 ? k.slice(dot).toLowerCase() : '';
        return allowed.has(ext);
      });
    if (!keys.length) {
      console.warn('No image keys under', imagesPrefix);
      continue;
    }
    const items = [] as Array<{ filename: string; width: number; height: number; alt: string }>;
    for (const key of keys) {
      let width = 1600, height = 900;
      try {
        const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        const meta = head.Metadata || {} as Record<string,string>;
        const w = Number(meta.width || (meta['x-amz-meta-width'] as unknown as string | undefined));
        const h = Number(meta.height || (meta['x-amz-meta-height'] as unknown as string | undefined));
        if (!Number.isNaN(w) && !Number.isNaN(h)) { width = w; height = h; }
      } catch {}
      items.push({ filename: key.replace(imagesPrefix, ''), width, height, alt: path.basename(key) });
    }
    const body = JSON.stringify({ images: items }, null, 0);
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: `${imagesPrefix}_manifest.json`, Body: body, ContentType: 'application/json', CacheControl: 'public, max-age=60' }));
    console.log('Wrote manifest:', `${imagesPrefix}_manifest.json`, `(${items.length} images)`);
    total += items.length;
  }
  console.log('Done. Total images described:', total);
}

main().catch(e => { console.error(e); process.exit(1); });
