// Posts module: Prefer static snapshot (public/posts.json) at runtime to avoid D1 hits.

export function getAuthorSlug(author: string): string {
  return author.toLowerCase().replace(/\s+/g, '-');
}

export function getProperAuthorName(slug: string): string {
  return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export interface Post {
  slug: string;
  path?: string;
  title: string;
  date: string;
  timezone: string;
  excerpt?: string;
  content: string;
  author: string;
  tags?: string[];
  thumbnail?: string;
  width?: 'small' | 'medium' | 'large';
  downloadUrl?: string;
}
// Internal: map a DB row to Post
type RowShape = Partial<Record<'path'|'slug'|'title'|'date'|'date_utc'|'timezone'|'excerpt'|'content'|'author'|'thumbnail'|'width'|'downloadUrl'|'download_url'|'tags', unknown>>;
function mapRowToPost(r: RowShape): Post {
  const rawDl = (r as Record<string, unknown>).downloadUrl ?? (r as Record<string, unknown>).download_url;
  let downloadUrl = rawDl == null ? undefined : String(rawDl);
  if (downloadUrl && /^(null|undefined)?$/i.test(downloadUrl.trim())) downloadUrl = undefined;
  let tags: string[] | undefined;
  if (r.tags != null) {
    try {
      if (typeof r.tags === 'string' && r.tags.trim().startsWith('[')) {
        tags = (JSON.parse(r.tags) as unknown[])
          .map(v => String(v).trim())
          .filter(s => s && !/^(null|undefined)$/i.test(s));
      } else if (Array.isArray(r.tags)) {
        const out: string[] = [];
        for (const v of (r.tags as unknown[])) {
          const s = String(v).trim();
          if (!s) continue;
          if (s.startsWith('[')) {
            try {
              const arr = JSON.parse(s) as unknown[];
              for (const a of arr) {
                const t = String(a).trim();
                if (t && !/^(null|undefined)$/i.test(t)) out.push(t);
              }
            } catch {
              out.push(s);
            }
          } else {
            out.push(s);
          }
        }
        tags = out.filter(Boolean);
      } else {
        const s = String(r.tags);
        const parts = (s.includes('||') ? s.split('||') : s.split(','));
        tags = parts.map(x => x.trim()).filter(x => x && !/^(null|undefined)$/i.test(x));
      }
      if (tags && tags.length) tags = Array.from(new Set(tags));
    } catch {
      tags = undefined;
    }
  }
  const slug = String(r.slug ?? '');
  const dateStr = String((r as Record<string, unknown>).date ?? (r as Record<string, unknown>).date_utc ?? '');
  let thumb: string | undefined = r.thumbnail ? String(r.thumbnail) : undefined;
  if (!thumb && slug && dateStr) {
    try {
      const cdn = (process.env.CDN_SITE && /^https?:\/\//.test(process.env.CDN_SITE)) ? process.env.CDN_SITE : 'https://cdn.dhugs.com';
      const d = new Date(dateStr);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      thumb = `${cdn}/o/${y}/${m}/${slug}/thumbnail.avif`;
    } catch {}
  }
  return {
    path: r.path ? String(r.path) : undefined,
    slug,
    title: String(r.title ?? ''),
    date: dateStr,
    timezone: String(r.timezone ?? ''),
    excerpt: r.excerpt ? String(r.excerpt) : undefined,
    content: r.content ? String(r.content) : '',
    tags,
    author: String(r.author ?? ''),
    thumbnail: thumb,
    width: (r.width ? String(r.width) : 'medium') as Post['width'],
    downloadUrl,
  };
}

// SQL fragments (build-time fallback only)
const SQL_ALL = `SELECT p.path,p.slug,p.type,p.title,p.author,p.excerpt,p.content,p.date_utc as date,p.timezone,p.width,p.thumbnail,p.download_url as downloadUrl, GROUP_CONCAT(t.name,'||') as tags
FROM posts p
LEFT JOIN post_tags pt ON pt.post_id=p.id
LEFT JOIN tags t ON t.id=pt.tag_id
GROUP BY p.id
ORDER BY p.date_utc DESC`;

// Simple in-memory cache to reduce repeated calls during a single request lifecycle
let allPostsCache: Promise<Post[]> | null = null;
const singlePostCache = new Map<string, Promise<Post | null>>();

async function loadStaticPosts(reqUrl?: string): Promise<Post[]> {
  // Try Cloudflare ASSETS binding first
  try {
    type CloudflareContext = { env?: Record<string, unknown> };
    type OpenNextCloudflare = { getCloudflareContext?: (opts?: { async?: boolean }) => Promise<CloudflareContext> };
    let env: Record<string, unknown> | undefined;
    try {
      const mod = (await import('@opennextjs/cloudflare')) as unknown as OpenNextCloudflare;
      const ctx = await mod.getCloudflareContext?.({ async: true });
      env = ctx?.env;
    } catch {
      const g = globalThis as Record<string | symbol, unknown>;
      const cfCtxSym = Symbol.for('__cloudflare-context__');
      const ctx = g[cfCtxSym] as { env?: Record<string, unknown> } | undefined;
      env = ctx?.env;
    }
    const assets = env?.ASSETS as unknown as { fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> } | undefined;
    if (assets && typeof assets.fetch === 'function') {
      const base = reqUrl ? new URL(reqUrl) : new URL('https://local.invalid/');
      const req = new Request(new URL('/posts.json', base).toString());
      const res = await assets.fetch(req);
      if (res.ok) {
        const arr = await res.json() as unknown[];
        return (arr as RowShape[]).map(mapRowToPost);
      }
    }
  } catch {}
  // Node dev/build: read from filesystem
  if (typeof process !== 'undefined' && process.release?.name === 'node') {
    try {
      const fs = await import('node:fs/promises');
      const p = await fs.readFile('public/posts.json', 'utf8');
      const arr = JSON.parse(p) as RowShape[];
      return arr.map(mapRowToPost);
    } catch {}
  }
  // HTTP fallback
  try {
    const u = reqUrl ? new URL('/posts.json', reqUrl) : new URL('https://'+(process.env.CDN_SITE || 'cdn.dhugs.com')+'/posts.json');
    const res = await fetch(u.toString(), { cf: { cacheEverything: true, cacheTtl: 600 } } as RequestInit & { cf?: unknown });
    if (res.ok) {
      const arr = await res.json() as RowShape[];
      return arr.map(mapRowToPost);
    }
  } catch {}
  return [];
}

async function nodeQueryRest(sql: string): Promise<RowShape[]> {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.ADMIN_API_TOKEN;
    let databaseId = process.env.D1_DATABASE_ID;
    if (!databaseId) {
      try {
        const fs = await import('node:fs');
        const wrangler = fs.readFileSync('wrangler.jsonc', 'utf8');
        const m = wrangler.match(/"database_id"\s*:\s*"([a-fA-F0-9-]+)"/);
        if (m) databaseId = m[1];
      } catch {
        // ignore missing file
      }
    }
    if (!accountId || !apiToken || !databaseId) return [];
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ sql }),
    });
    if (!res.ok) return [];
    const json = await res.json() as { result?: { results?: unknown[] } } | { results?: unknown[] } | unknown;
    const maybeResult = (json as { result?: { results?: unknown[] } }).result;
    const rows = maybeResult?.results || (json as { results?: unknown[] }).results || [];
    return Array.isArray(rows) ? (rows as RowShape[]) : [];
  } catch {
    return [];
  }
}

// Worker-side query using Cloudflare binding (access env via AsyncLocalStorage symbol)
// Removed workerQuery: runtime access to D1 is not used; pages read from static posts.json

// Merge markdown and album posts from D1
export async function getAllPosts(reqUrl?: string): Promise<Post[]> {
  if (allPostsCache) return allPostsCache;
  allPostsCache = (async () => {
    const staticPosts = await loadStaticPosts(reqUrl);
    if (staticPosts.length) return staticPosts;
    if (typeof process !== 'undefined' && process.release?.name === 'node') {
      const rows = await nodeQueryRest(SQL_ALL);
      return rows.map(mapRowToPost) as Post[];
    }
    return [] as Post[];
  })();
  return allPostsCache;
}

// Retrieve a post by full path (YYYY/MM/slug) from D1
export async function getPostByPath(pathSeg: string, reqUrl?: string): Promise<Post | null> {
  if (singlePostCache.has(pathSeg)) return singlePostCache.get(pathSeg)!;
  const promise = (async () => {
    const all = await getAllPosts(reqUrl);
    const hit = all.find(p => p.path === pathSeg);
    if (hit) return hit;
    if (typeof process !== 'undefined' && process.release?.name === 'node') {
      const rows = await nodeQueryRest(SQL_ALL);
      const mapped = rows.map(mapRowToPost) as Post[];
      const m = mapped.find(p => p.path === pathSeg);
      if (m) return m;
    }
    return null;
  })();
  singlePostCache.set(pathSeg, promise);
  return promise;
}
