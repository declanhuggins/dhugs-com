import { NextResponse } from 'next/server';

type D1AllResult = { results?: unknown[]; rows?: unknown[] };
type D1Prepared = { all: () => Promise<D1AllResult> };
type D1Like = { prepare: (sql: string) => D1Prepared };
type EnvLike = { D1_POSTS?: D1Like };

async function d1(sql: string): Promise<Record<string, unknown>[]> {
  try {
    const g = globalThis as Record<string | symbol, unknown>;
    const cfCtxSym = Symbol.for("__cloudflare-context__");
    const ctx = g[cfCtxSym] as { env?: EnvLike } | undefined;
    const env = (ctx?.env || (g as Record<string, unknown>).env || (g as Record<string, unknown>).ENV || (g as Record<string, unknown>).ENVIRONMENT) as EnvLike | undefined;
    const db = env?.D1_POSTS;
    if (!db) return [];
    const res = await db.prepare(sql).all();
    const rows = Array.isArray(res.results) ? res.results : (Array.isArray(res.rows) ? res.rows : []);
    return (rows as Record<string, unknown>[]) || [];
  } catch {
    return [];
  }
}

export async function GET() {
  const posts = await d1('SELECT COUNT(*) as c FROM posts;');
  const tags = await d1('SELECT COUNT(*) as c FROM tags;');
  const latest = await d1('SELECT path, slug, title, date_utc FROM posts ORDER BY date_utc DESC LIMIT 5;');
  const out = {
    d1: {
      posts: (posts[0]?.c as number) ?? 0,
      tags: (tags[0]?.c as number) ?? 0,
      latest,
    },
  };
  return NextResponse.json(out, { status: 200 });
}
