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
interface R2ObjectLike { key?: string; name?: string }
interface R2ListResult { objects?: R2ObjectLike[]; keys?: R2ObjectLike[] }
interface R2HeadMeta { customMetadata?: Record<string, unknown>; httpMetadata?: { headers?: Record<string, unknown> } }
interface R2BucketLike {
  list(options: { prefix: string }): Promise<R2ListResult>;
  head(key: string): Promise<R2HeadMeta | null>;
}
interface WorkerEnvLike { R2_ASSETS?: R2BucketLike; CDN_SITE?: string }

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
  const env: WorkerEnvLike | undefined = cfCtx?.env || g.env || g.ENV || g.ENVIRONMENT;
  const bucket: R2BucketLike | undefined = env?.R2_ASSETS;
  if (!force && albumCache.has(albumName)) return albumCache.get(albumName)!;
  const prefix = albumName.endsWith('/') ? albumName : `${albumName}/`;
  // Prefer Cloudflare Worker binding for CDN host when available
  // In Workers with nodejs_compat, `process` exists but does not carry .env; using it first breaks URLs.
  const cdnCandidate = (env as Record<string, unknown> | undefined)?.CDN_SITE ?? (typeof process !== 'undefined' ? process.env.CDN_SITE : '');
  const cdnBase = (typeof cdnCandidate === 'string' && /^https?:\/\//i.test(cdnCandidate))
    ? cdnCandidate.replace(/\/+$/, '')
    : 'https://cdn.dhugs.com';
  
  // If running in Cloudflare Worker with an R2 binding, use it
  if (bucket) {
    try {
      const prefixesToTry = [prefix, prefix.replace(/\/images\/?$/, '/')];
      for (const p of prefixesToTry) {
        const listing = await bucket.list({ prefix: p });
        const listObjects: R2ObjectLike[] = (listing.objects || listing.keys || []).filter(Boolean) as R2ObjectLike[];
        const images: AlbumImage[] = await Promise.all(
          listObjects
            .map(o => (o.key || o.name || '').toString())
            .filter(key => {
              if (!key) return false;
              const ext = key.slice(key.lastIndexOf('.')).toLowerCase();
              return allowedExtensions.includes(ext) && !key.endsWith('/_meta.json');
            })
            .map(async key => {
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
              } catch {
                // ignore metadata errors
              }
              const filename = key.replace(p, '');
              const baseUrl = `${cdnBase}/${albumName}/${filename}`.replace(/([^:])\\+/g, '$1/');
              return { filename, largeURL: baseUrl, thumbnailURL: baseUrl, width, height, alt: filename } satisfies AlbumImage;
            })
        );
        if (images.length > 0) {
          if (p !== prefix) {
            console.warn(`[album] Found images under '${p}' (fallback without '/images'). Consider normalizing album structure.`);
          }
          albumCache.set(albumName, images);
          return images;
        }
      }
      console.warn(`[album] No images found for either prefix '${prefix}' or fallback '${prefix.replace(/\/images\/?$/, '/')}' in Worker R2 binding.`);
      return [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[album] R2 list failed for prefix '${prefix}': ${msg}`);
    }
  }

  // Build-time/Node path: list via S3 SDK (R2-compatible)
  if (typeof process !== 'undefined') {
    const endpoint = process.env.S3_ENDPOINT || process.env.AWS_S3_ENDPOINT || '';
    const region = process.env.AWS_REGION || 'auto';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID_WRITE || '';
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY_WRITE || '';
    const bucketName = process.env.AWS_BUCKET_NAME || process.env.R2_BUCKET_NAME;
    const missing: string[] = [];
    if (!endpoint) missing.push('S3_ENDPOINT');
    if (!bucketName) missing.push('AWS_BUCKET_NAME or R2_BUCKET_NAME');
    if (!accessKeyId) missing.push('AWS_ACCESS_KEY_ID');
    if (!secretAccessKey) missing.push('AWS_SECRET_ACCESS_KEY');

    if (missing.length) {
      throw new Error(`[album] Missing required env for build-time R2 access: ${missing.join(', ')}. Album: '${albumName}', Prefix: '${prefix}'.`);
    }

    try {
      const { S3Client, ListObjectsV2Command, HeadObjectCommand } = await import('@aws-sdk/client-s3');
      const s3 = new S3Client({ region, endpoint, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } });
      const prefixesToTry = [prefix, prefix.replace(/\/images\/?$/, '/')];
      for (const p of prefixesToTry) {
        const out = await s3.send(new ListObjectsV2Command({ Bucket: bucketName!, Prefix: p }));
        const keys = (out.Contents || []).map(o => o.Key || '').filter(Boolean) as string[];
        const filtered = keys.filter(key => {
          const ext = key.slice(key.lastIndexOf('.')).toLowerCase();
          return allowedExtensions.includes(ext) && !key.endsWith('/_meta.json');
        });
        const images: AlbumImage[] = await Promise.all(filtered.map(async (key) => {
          let width = 1600;
          let height = 900;
          try {
            const head = await s3.send(new HeadObjectCommand({ Bucket: bucketName!, Key: key }));
            const meta = head.Metadata || {};
            const wRaw = meta.width || (meta as Record<string, unknown>)["x-amz-meta-width"] as unknown as string | undefined;
            const hRaw = meta.height || (meta as Record<string, unknown>)["x-amz-meta-height"] as unknown as string | undefined;
            const w = Number(typeof wRaw === 'string' ? wRaw : undefined);
            const hh = Number(typeof hRaw === 'string' ? hRaw : undefined);
            if (!Number.isNaN(w) && !Number.isNaN(hh)) { width = w; height = hh; }
          } catch {}
          const filename = key.replace(p, '');
          const baseUrl = `${cdnBase}/${albumName}/${filename}`.replace(/([^:])\\+/g, '$1/');
          return { filename, largeURL: baseUrl, thumbnailURL: baseUrl, width, height, alt: filename } satisfies AlbumImage;
        }));
        if (images.length > 0) {
          if (p !== prefix) {
            console.warn(`[album] Found images under '${p}' (fallback without '/images') during build. Consider normalizing album structure.`);
          }
          albumCache.set(albumName, images);
          return images;
        }
      }
      console.warn(`[album] No images found for either prefix '${prefix}' or fallback '${prefix.replace(/\/images\/?$/, '/')}' in S3/R2 (build-time).`);
      return [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[album] S3 list failed for bucket '${bucketName}' prefix '${prefix}': ${msg}`);
    }
  }
  // Fallback when no env or credentials available
  throw new Error(`[album] No R2 binding and no S3 credentials found for album '${albumName}' (prefix '${prefix}'). Set Cloudflare Worker binding 'R2_ASSETS' at runtime or provide build-time env: S3_ENDPOINT, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_BUCKET_NAME (or R2_BUCKET_NAME).`);
}
