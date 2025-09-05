// Posts module: Always query D1 via Cloudflare Worker binding at runtime.
// No wrangler usage here; build-time static generation is avoided in pages.

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
  const rawTags = r.tags == null ? undefined : String(r.tags);
  const tags = rawTags
    ? rawTags.split('||').map(s => s.trim()).filter(s => s && !/^(null|undefined)$/i.test(s))
    : undefined;
  return {
    path: r.path ? String(r.path) : undefined,
    slug: String(r.slug ?? ''),
    title: String(r.title ?? ''),
    date: String((r as Record<string, unknown>).date ?? (r as Record<string, unknown>).date_utc ?? ''),
    timezone: String(r.timezone ?? ''),
    excerpt: r.excerpt ? String(r.excerpt) : undefined,
    content: r.content ? String(r.content) : '',
    tags,
    author: String(r.author ?? ''),
    thumbnail: r.thumbnail ? String(r.thumbnail) : undefined,
    width: (r.width ? String(r.width) : 'medium') as Post['width'],
    downloadUrl,
  };
}

// SQL fragments
const SQL_ALL = `SELECT p.path,p.slug,p.type,p.title,p.author,p.excerpt,p.content,p.date_utc as date,p.timezone,p.width,p.thumbnail,p.download_url as downloadUrl, GROUP_CONCAT(t.name,'||') as tags
FROM posts p
LEFT JOIN post_tags pt ON pt.post_id=p.id
LEFT JOIN tags t ON t.id=pt.tag_id
GROUP BY p.id
ORDER BY p.date_utc DESC`;
const SQL_ONE_BY_PATH = `SELECT p.path,p.slug,p.type,p.title,p.author,p.excerpt,p.content,p.date_utc as date,p.timezone,p.width,p.thumbnail,p.download_url as downloadUrl, GROUP_CONCAT(t.name,'||') as tags
FROM posts p
LEFT JOIN post_tags pt ON pt.post_id=p.id
LEFT JOIN tags t ON t.id=pt.tag_id
WHERE p.path=?
GROUP BY p.id
LIMIT 1`;

// Simple in-memory cache to reduce repeated calls during a single request lifecycle
let allPostsCache: Promise<Post[]> | null = null;
const singlePostCache = new Map<string, Promise<Post | null>>();
// No local JSON snapshot support; rely on D1 via binding at runtime and D1 REST API at build-time.

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
async function workerQuery(sql: string, binds?: unknown[]): Promise<RowShape[]> {
  try {
    // Prefer official OpenNext Cloudflare context helper
    type CloudflareContext = { env?: Record<string, unknown> };
    type OpenNextCloudflare = { getCloudflareContext?: (opts?: { async?: boolean }) => Promise<CloudflareContext> };
    let env: Record<string, unknown> | undefined;
    try {
      const mod = (await import('@opennextjs/cloudflare')) as unknown as OpenNextCloudflare;
      const ctx = await mod.getCloudflareContext?.({ async: true });
      env = ctx?.env as Record<string, unknown> | undefined;
    } catch {
      // fall back to global symbol if helper not available in this phase
      const g = globalThis as Record<string | symbol, unknown>;
      const cfCtxSym = Symbol.for("__cloudflare-context__");
      const ctx = (g[cfCtxSym] as { env?: unknown } | undefined);
      env = (ctx?.env ?? (g as Record<string, unknown>).env ?? (g as Record<string, unknown>).ENV ?? (g as Record<string, unknown>).ENVIRONMENT) as Record<string, unknown> | undefined;
    }
    const db = env?.D1_POSTS as unknown as { prepare?: (sql: string) => { bind?: (...args: unknown[]) => { all: () => Promise<unknown> }; all: () => Promise<unknown> } } | undefined;
    const prepared = db?.prepare?.(sql);
    if (!prepared) return [];
    const stmt = Array.isArray(binds) && binds.length && prepared.bind ? prepared.bind(...binds) : prepared;
    const result = await stmt.all() as { results?: unknown; rows?: unknown } | unknown;
    const maybeResults = (result as { results?: unknown }).results;
    const maybeRows = (result as { rows?: unknown }).rows;
    const rowsUnknown = Array.isArray(maybeResults) ? maybeResults : (Array.isArray(maybeRows) ? maybeRows : []);
    return rowsUnknown as RowShape[];
  } catch {
    return [];
  }
}

// Merge markdown and album posts from D1
export async function getAllPosts(): Promise<Post[]> {
  if (allPostsCache) return allPostsCache;
  allPostsCache = (async () => {
    const rowsWorker = await workerQuery(SQL_ALL);
    if (rowsWorker.length) return rowsWorker.map(mapRowToPost) as Post[];
    if (typeof process !== 'undefined' && process.release?.name === 'node') {
      const rows = await nodeQueryRest(SQL_ALL);
      return rows.map(mapRowToPost) as Post[];
    }
    return [] as Post[];
  })();
  try {
    return await allPostsCache;
  } finally {
    // keep cache populated for rest of build; don't clear
  }
}

// Retrieve a post by full path (YYYY/MM/slug) from D1
export async function getPostByPath(pathSeg: string): Promise<Post | null> {
  if (singlePostCache.has(pathSeg)) return singlePostCache.get(pathSeg)!;
  const promise = (async () => {
    const sql = SQL_ONE_BY_PATH; // contains a single '?'
    const rowsRuntime = await workerQuery(sql, [pathSeg]);
    if (rowsRuntime.length > 0) return mapRowToPost(rowsRuntime[0]);
    if (typeof process !== 'undefined' && process.release?.name === 'node') {
      // Fallback for build-time: inline the param safely
      const esc = pathSeg.replace(/'/g, "''");
      const rows = await nodeQueryRest(sql.replace('=?', `='${esc}'`));
      if (rows.length > 0) return mapRowToPost(rows[0]);
    }
    return null;
  })();
  singlePostCache.set(pathSeg, promise);
  return promise;
}
