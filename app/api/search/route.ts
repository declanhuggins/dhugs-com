import { NextResponse } from 'next/server';
import type { Post } from '../../../lib/posts';

type D1AllResult = { results?: unknown[]; rows?: unknown[] };
type D1Prepared = { bind?: (...args: unknown[]) => D1Prepared; all: () => Promise<D1AllResult> };
type D1Like = { prepare: (sql: string) => D1Prepared };
type EnvLike = { D1_POSTS?: D1Like };

function mapRowToPost(r: Record<string, unknown>): Post {
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

async function d1All(sql: string, binds?: unknown[]): Promise<Record<string, unknown>[]> {
  try {
    // Prefer OpenNext Cloudflare helper
    type CloudflareContext = { env?: EnvLike };
    type OpenNextCloudflare = { getCloudflareContext?: (opts?: { async?: boolean }) => Promise<CloudflareContext> };
    let env: EnvLike | undefined;
    try {
      const mod = (await import('@opennextjs/cloudflare')) as unknown as OpenNextCloudflare;
      const ctx = await mod.getCloudflareContext?.({ async: true });
      env = ctx?.env as EnvLike | undefined;
    } catch {
      const g = globalThis as Record<string | symbol, unknown>;
      const cfCtxSym = Symbol.for('__cloudflare-context__');
      const ctx = g[cfCtxSym] as { env?: EnvLike } | undefined;
      env = (ctx?.env || (g as Record<string, unknown>).env || (g as Record<string, unknown>).ENV || (g as Record<string, unknown>).ENVIRONMENT) as EnvLike | undefined;
    }
    const db = env?.D1_POSTS;
    if (!db) return [];
    const prepared = db.prepare(sql);
    const stmt = Array.isArray(binds) && binds.length && prepared.bind ? prepared.bind(...binds) : prepared;
    const res = await stmt.all();
    const rows = Array.isArray(res.results) ? res.results : (Array.isArray(res.rows) ? res.rows : []);
    return (rows as Record<string, unknown>[]) || [];
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json([] satisfies Post[], { status: 200 });
  // LIKE search on title, excerpt, content using bound parameters.
  const sql = `SELECT p.path,p.slug,p.type,p.title,p.author,p.excerpt,p.content,p.date_utc as date,p.timezone,p.width,p.thumbnail,p.download_url as downloadUrl, GROUP_CONCAT(t.name,'||') as tags
FROM posts p
LEFT JOIN post_tags pt ON pt.post_id=p.id
LEFT JOIN tags t ON t.id=pt.tag_id
WHERE p.title LIKE '%' || ? || '%' OR p.excerpt LIKE '%' || ? || '%' OR p.content LIKE '%' || ? || '%'
GROUP BY p.id
ORDER BY p.date_utc DESC
LIMIT 50;`;
  const rows = await d1All(sql, [q, q, q]);
  const posts = rows.map(mapRowToPost);
  return NextResponse.json(posts as Post[], { status: 200 });
}
