// Album image listing using Cloudflare R2 when running in Worker/Edge.
// No local fallbacks; images must exist in R2.

export interface AlbumImage {
  filename: string;
  largeURL: string;
  thumbnailURL: string;
  width: number;
  height: number;
  alt: string;
}

// Minimal R2 bucket shapes (avoid full workers types dependency)
// Minimal R2 bucket shapes (for Worker runtime)
interface R2ObjectLike { key?: string; name?: string }
interface R2ListResult { objects?: R2ObjectLike[]; keys?: R2ObjectLike[] }
interface R2HeadMeta { customMetadata?: Record<string, unknown>; httpMetadata?: { headers?: Record<string, unknown> } }
interface R2BucketLike {
  list(options: { prefix: string }): Promise<R2ListResult>;
  head(key: string): Promise<R2HeadMeta | null>;
}

interface WorkerEnvLike { CDN_SITE?: string; R2_ASSETS?: R2BucketLike; [k: string]: unknown }

const allowedExtensions = [".jpg", ".jpeg", ".png", ".avif"];
const albumCache = new Map<string, AlbumImage[]>();

export async function getAlbumImages(albumName: string, force = false): Promise<AlbumImage[]> {
  const g = globalThis as unknown as {
    [k: symbol]: unknown;
    env?: WorkerEnvLike;
    ENV?: WorkerEnvLike;
    ENVIRONMENT?: WorkerEnvLike;
  };

  // Prefer OpenNext Cloudflare context (AsyncLocalStorage) for env bindings
  const cfCtxSym = Symbol.for("__cloudflare-context__");
  const cfCtx = (g as Record<string | symbol, unknown>)[cfCtxSym] as { env?: WorkerEnvLike } | undefined;
  const workerEnv: WorkerEnvLike | undefined = cfCtx?.env || g.env || g.ENV || g.ENVIRONMENT;

  if (!force && albumCache.has(albumName)) return albumCache.get(albumName)!;
  const prefix = albumName.endsWith('/') ? albumName : `${albumName}/`;

  // Resolve CDN base (build-time from process.env, runtime from workerEnv)
  const cdnCandidate = (typeof process !== 'undefined' && (process.env.CDN_SITE))
    || (workerEnv as Record<string, unknown> | undefined)?.CDN_SITE
    || '';
  const cdnBase = (typeof cdnCandidate === 'string' && /^https?:\/\//i.test(cdnCandidate))
    ? cdnCandidate.replace(/\/+$/, '')
    : 'https://cdn.dhugs.com';

  // Determine environment once (must be before usage)
  const isNode = typeof process !== 'undefined' && !!process.release?.name && process.release.name === 'node';

  // If running inside a Worker and an R2 binding is available, use it (no Node APIs)
  if (!isNode) {
    try {
      const bucket = workerEnv?.R2_ASSETS;
      if (!bucket) return [];
      const prefixesToTry = [prefix, prefix.replace(/\/images\/?$/, '/')];
      for (const p of prefixesToTry) {
        const listing = await bucket.list({ prefix: p });
        const listObjects: R2ObjectLike[] = (listing.objects || listing.keys || []).filter(Boolean) as R2ObjectLike[];
        const keys = listObjects
          .map(o => (o.key || o.name || '').toString())
          .filter(Boolean);
        const filtered = keys.filter(key => {
          const ext = key.slice(key.lastIndexOf('.')).toLowerCase();
          return allowedExtensions.includes(ext) && !key.endsWith('/_meta.json');
        });
        const images: AlbumImage[] = await Promise.all(filtered.map(async (key) => {
          let width = 1600;
          let height = 900;
          try {
            const h = await bucket.head(key);
            const meta = h?.customMetadata || h?.httpMetadata?.headers || {};
            const wRaw = (meta as Record<string, unknown>).width || (meta as Record<string, unknown>)["x-amz-meta-width"];
            const hRaw = (meta as Record<string, unknown>).height || (meta as Record<string, unknown>)["x-amz-meta-height"];
            const w = Number(typeof wRaw === 'string' ? wRaw : (wRaw as { toString?: () => string })?.toString?.());
            const hh = Number(typeof hRaw === 'string' ? hRaw : (hRaw as { toString?: () => string })?.toString?.());
            if (!Number.isNaN(w) && !Number.isNaN(hh)) { width = w; height = hh; }
          } catch {}
          const filename = key.replace(p, '');
          const baseUrl = `${cdnBase}/${albumName}/${filename}`.replace(/([^:])\\+/g, '$1/').replace(/([^:])\/+\/+/g,'$1/');
          return { filename, largeURL: baseUrl, thumbnailURL: baseUrl, width, height, alt: filename } as AlbumImage;
        }));
        if (images.length) return images;
      }
      return [];
    } catch {
      return [];
    }
  }

  // Collect credentials for S3/R2 compatible listing (build-time)
  const endpoint = (typeof process !== 'undefined' && process.env.S3_ENDPOINT) || '';
  const region = (typeof process !== 'undefined' && process.env.AWS_REGION) || 'auto';
  const accessKeyId = (typeof process !== 'undefined' && (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID_WRITE)) || '';
  const secretAccessKey = (typeof process !== 'undefined' && (process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY_WRITE)) || '';
  const bucketName = (typeof process !== 'undefined' && (process.env.AWS_BUCKET_NAME || process.env.R2_BUCKET_NAME)) || '';

  // isNode is true here
  const missing: string[] = [];
  if (!endpoint) missing.push('S3_ENDPOINT');
  if (!bucketName) missing.push('AWS_BUCKET_NAME or R2_BUCKET_NAME');
  if (!accessKeyId) missing.push('AWS_ACCESS_KEY_ID');
  if (!secretAccessKey) missing.push('AWS_SECRET_ACCESS_KEY');
  if (missing.length) {
    throw new Error(`[album] Missing required env for R2 access: ${missing.join(', ')}. Album: '${albumName}', Prefix: '${prefix}'.`);
  }

  try {
    const { S3Client, ListObjectsV2Command, HeadObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({ region, endpoint, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } });
    const prefixesToTry = [prefix, prefix.replace(/\/images\/?$/, '/')];
    let keys: string[] = [];
    for (const p of prefixesToTry) {
      const out = await s3.send(new ListObjectsV2Command({ Bucket: String(bucketName), Prefix: p }));
      keys = (out.Contents || []).map(o => (o.Key || '') as string).filter(Boolean);
      if (keys.length) {
        const filtered = keys.filter(key => {
          const ext = key.slice(key.lastIndexOf('.')).toLowerCase();
          return allowedExtensions.includes(ext) && !key.endsWith('/_meta.json');
        });
        const images: AlbumImage[] = await Promise.all(filtered.map(async (key) => {
          let width = 1600;
          let height = 900;
          try {
            const head = await s3.send(new HeadObjectCommand({ Bucket: String(bucketName), Key: key }));
            const meta = head.Metadata || {} as Record<string, string>;
            const wRaw = meta.width || (meta["x-amz-meta-width"] as unknown as string | undefined);
            const hRaw = meta.height || (meta["x-amz-meta-height"] as unknown as string | undefined);
            const w = Number(typeof wRaw === 'string' ? wRaw : undefined);
            const hh = Number(typeof hRaw === 'string' ? hRaw : undefined);
            if (!Number.isNaN(w) && !Number.isNaN(hh)) { width = w; height = hh; }
          } catch {}
          const filename = key.replace(p, '');
          const baseUrl = `${cdnBase}/${albumName}/${filename}`.replace(/([^:])\/+\/+/g, '$1/').replace(/([^:])\\+/g, '$1/');
          return { filename, largeURL: baseUrl, thumbnailURL: baseUrl, width, height, alt: filename } as AlbumImage;
        }));
        if (images.length) {
          // Log like old behavior when '/images' fallback matched
          if (p !== prefix) {
            console.warn(`[album] Found images under '${p}' (fallback without '/images') during build. Consider normalizing album structure.`);
          }
          albumCache.set(albumName, images);
          return images;
        }
      }
    }
    console.warn(`[album] No images found for prefix '${prefix}' via S3.`);
    return [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[album] S3 list failed for bucket '${bucketName}' prefix '${prefix}': ${msg}`);
  }
}
