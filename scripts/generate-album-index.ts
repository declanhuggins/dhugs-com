import dotenv from 'dotenv';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { S3Client, ListObjectsV2Command, HeadObjectCommand, ListObjectsV2CommandOutput } from '@aws-sdk/client-s3';
import { spawnSync } from 'node:child_process';

dotenv.config({ path: '.env', quiet: true });

type Post = {
  path?: string;
  slug: string;
  content?: string;
  date: string;
  timezone: string;
};

export type AlbumImage = {
  filename: string;
  largeURL: string;
  thumbnailURL: string;
  width: number;
  height: number;
  alt: string;
};

type AlbumIndex = Record<string, AlbumImage[]>;

const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.avif']);

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

async function listAllKeys(s3: S3Client, bucket: string, prefix: string): Promise<string[]> {
  let ContinuationToken: string | undefined = undefined;
  const keys: string[] = [];
  do {
    const out: ListObjectsV2CommandOutput = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken }));
    const part = (out.Contents || []).map(o => String(o.Key || '')).filter(Boolean);
    keys.push(...part);
    ContinuationToken = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return keys;
}

async function main() {
  const postsPath = path.join(process.cwd(), 'dist', 'data', 'posts.json');
  if (!fs.existsSync(postsPath)) {
    throw new Error(`dist/data/posts.json not found. Run 'npm run content:postsJson' first.`);
  }
  const posts = JSON.parse(await fsp.readFile(postsPath, 'utf8')) as Post[];
  const albumPosts = posts.filter(p => (p.content ?? '') === '');
  const albums = new Set<string>();
  for (const p of albumPosts) {
    const pathSeg = p.path || '';
    if (!pathSeg) continue;
    const album = `o/${pathSeg}/images`;
    albums.add(album);
  }
  // Always include portfolio album (special, not backed by a post)
  albums.add('o/portfolio/images');

  if (albums.size === 0) {
    // Still write an empty index to keep build deterministic
    const outEmpty = path.join(process.cwd(), 'dist', 'data', 'album-index.json');
    await fsp.mkdir(path.dirname(outEmpty), { recursive: true });
    await fsp.writeFile(outEmpty, JSON.stringify({}), 'utf8');
    console.log('No album posts detected. Wrote empty dist/data/album-index.json');
    return;
  }

  const cdnCandidate = process.env.CDN_SITE || '';
  const cdnBase = /^https?:\/\//i.test(cdnCandidate) ? cdnCandidate.replace(/\/+$/, '') : 'https://cdn.dhugs.com';

  // Prefer S3-style creds if available; otherwise fall back to Wrangler R2 CLI (works in CF build env)
  const hasS3 = !!(process.env.S3_ENDPOINT && (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID_WRITE));
  let s3: S3Client | null = null;
  let bucket = process.env.AWS_BUCKET_NAME || process.env.R2_BUCKET_NAME || '';
  if (hasS3) {
    const endpoint = requireEnv('S3_ENDPOINT');
    const region = process.env.AWS_REGION || 'auto';
    const accessKeyId = (process.env.AWS_ACCESS_KEY_ID_WRITE || process.env.AWS_ACCESS_KEY_ID)!;
    const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY_WRITE || process.env.AWS_SECRET_ACCESS_KEY)!;
    if (!bucket) throw new Error('Missing required env: AWS_BUCKET_NAME or R2_BUCKET_NAME');
    s3 = new S3Client({ region, endpoint, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } });
  }

  const cfEnv = process.env.CF_ENV || 'prod';

  function listKeysViaWrangler(prefix: string): string[] {
    const binding = 'R2_ASSETS';
    const res = spawnSync('npx', ['wrangler','r2','object','list', binding, '--env', cfEnv, '--prefix', prefix, '--json'], { encoding: 'utf8' });
    if (res.status !== 0) return [];
    try {
      const raw = (res.stdout || '').trim();
      if (!raw) return [];
      let arr: any[] = [];
      // Wrangler may output NDJSON lines; parse line-by-line when array parse fails
      try {
        const parsed = JSON.parse(raw);
        arr = Array.isArray(parsed) ? parsed : (Array.isArray((parsed as any)?.objects) ? (parsed as any).objects : []);
      } catch {
        arr = raw
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(Boolean)
          .map(l => { try { return JSON.parse(l); } catch { return null; } })
          .filter(Boolean) as any[];
      }
      const keys: string[] = [];
      for (const item of arr) {
        const k = (item && (item.key || (item as any).name || (item as any).Key)) as string | undefined;
        if (k) keys.push(k);
      }
      return keys;
    } catch {
      return [];
    }
  }

  const index: AlbumIndex = {};
  for (const albumName of albums) {
    const prefix = albumName.endsWith('/') ? albumName : `${albumName}/`;
    const prefixes = [prefix, prefix.replace(/\/images\/?$/, '/')];
    let keys: string[] = [];
    for (const p of prefixes) {
      if (s3) keys = await listAllKeys(s3, String(bucket), p);
      else keys = listKeysViaWrangler(p);
      if (!keys.length && !s3) {
        // Try manifest over CDN as a last resort
        try {
          const manifestUrl = `${cdnBase}/${p.replace(/\/+$/, '')}/_manifest.json`.replace(/([^:])\/+\/+/g, '$1/');
          const res = await fetch(manifestUrl);
          if (res.ok) {
            const json = await res.json() as { images?: Array<{ filename: string; width?: number; height?: number; alt?: string }> };
            const images = (json.images || []).map(it => {
              const url = `${cdnBase}/${albumName}/${it.filename}`.replace(/([^:])\/+\/+/g, '$1/');
              return { filename: it.filename, largeURL: url, thumbnailURL: url, width: Number(it.width || 1600), height: Number(it.height || 900), alt: it.alt || it.filename } as AlbumImage;
            });
            if (images.length) {
              index[albumName] = images;
              break; // manifest satisfied this album
            }
          }
        } catch {}
      }
      if (keys.length) {
        let filtered = keys.filter(k => {
          if (k.endsWith('/_meta.json')) return false;
          const dot = k.lastIndexOf('.');
          const ext = dot >= 0 ? k.slice(dot).toLowerCase() : '';
          return allowedExtensions.has(ext);
        });
        // If we matched the fallback prefix (without '/images'), keep only images/* files
        if (p !== prefix) {
          const imagesPrefix = (p.endsWith('/') ? p : p + '/') + 'images/';
          filtered = filtered.filter(k => k.startsWith(imagesPrefix));
        }
        const images: AlbumImage[] = await Promise.all(filtered.map(async (key) => {
          let width = 1600;
          let height = 900;
          if (s3) {
            try {
              const head = await s3.send(new HeadObjectCommand({ Bucket: String(bucket), Key: key }));
              const meta = (head.Metadata || {}) as Record<string, string>;
              const wRaw = meta.width || (meta['x-amz-meta-width'] as unknown as string | undefined);
              const hRaw = meta.height || (meta['x-amz-meta-height'] as unknown as string | undefined);
              const w = Number(typeof wRaw === 'string' ? wRaw : undefined);
              const hh = Number(typeof hRaw === 'string' ? hRaw : undefined);
              if (!Number.isNaN(w) && !Number.isNaN(hh)) { width = w; height = hh; }
            } catch {}
          }
          const filename = key.replace(p, '');
          const url = `${cdnBase}/${albumName}/${filename}`.replace(/([^:])\/+\/+/g, '$1/');
          return { filename, largeURL: url, thumbnailURL: url, width, height, alt: filename } as AlbumImage;
        }));
        index[albumName] = images;
        break;
      }
    }
    if (!index[albumName]) {
      // Final fallback: include just the thumbnail so album pages don’t break
      const thumbUrl = `${cdnBase}/${albumName.replace(/\/images\/?$/, '')}/thumbnail.avif`.replace(/([^:])\/+\/+/g, '$1/');
      index[albumName] = [{ filename: 'thumbnail.avif', largeURL: thumbUrl, thumbnailURL: thumbUrl, width: 1600, height: 900, alt: 'thumbnail' }];
    }
  }

  const outPath = path.join(process.cwd(), 'dist', 'data', 'album-index.json');
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  await fsp.writeFile(outPath, JSON.stringify(index), 'utf8');
  console.log(`Wrote ${Object.keys(index).length} albums to dist/data/album-index.json`);
}

main().catch((err) => { console.error(err); process.exit(1); });
