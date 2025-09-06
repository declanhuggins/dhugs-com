import { NextResponse } from 'next/server';
import type { Post } from '../../../lib/posts';

type DocMeta = {
  path?: string;
  slug: string;
  title: string;
  date: string;
  timezone: string;
  excerpt?: string;
  author: string;
  tags?: string[];
  thumbnail?: string;
  width?: Post['width'];
};

type PackedDoc = { m: DocMeta; dl: number };
type BM25IndexV2 = { v: 2; N: number; avdl: number; df: number[]; vocab: Record<string, number>; docs: (PackedDoc & { t: number[] })[] };
type BM25IndexV3 = { v: 3; N: number; avdl: number; df: number[]; vocab: Record<string, number>; postings: number[][]; docs: PackedDoc[] };
type BM25Index = BM25IndexV2 | BM25IndexV3;
type LegacyIndexItem = DocMeta & { h: string };

let cachedIndex: { data: BM25Index | LegacyIndexItem[]; ts: number } | null = null;
const INDEX_TTL_MS = 5 * 60 * 1000;

async function loadIndex(reqUrl: string): Promise<BM25Index | LegacyIndexItem[]> {
  const now = Date.now();
  if (cachedIndex && (now - cachedIndex.ts) < INDEX_TTL_MS) return cachedIndex.data;
  const assetPath = '/search-index.json';

  // Try Cloudflare ASSETS (prod worker)
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
      const req = new Request(new URL(assetPath, reqUrl));
      const res = await assets.fetch(req);
      if (res && res.ok) {
        const json = await res.json() as unknown;
        const hasVersion = !!(json && typeof json === 'object' && Object.prototype.hasOwnProperty.call(json as object, 'v'));
        const data = hasVersion ? (json as BM25Index) : (json as LegacyIndexItem[]);
        cachedIndex = { data, ts: now };
        return data;
      }
    }
  } catch {}

  // Node dev: read from filesystem
  if (typeof process !== 'undefined' && process.release?.name === 'node') {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const file = path.join(process.cwd(), 'dist', 'data', 'search-index.json');
      const content = await fs.readFile(file, 'utf8');
      const json = JSON.parse(content) as unknown;
      const hasVersion = !!(json && typeof json === 'object' && Object.prototype.hasOwnProperty.call(json as object, 'v'));
      const data = hasVersion ? (json as BM25Index) : (json as LegacyIndexItem[]);
      cachedIndex = { data, ts: now };
      return data;
    } catch {}
  }

  // Fallback: same-origin HTTP (cached at edge)
  const url = new URL(assetPath, reqUrl);
  const res = await fetch(url, { cf: { cacheEverything: true, cacheTtl: 3600 } } as RequestInit & { cf?: { cacheEverything?: boolean; cacheTtl?: number } });
  if (!res.ok) return [] as LegacyIndexItem[];
  const json = await res.json() as unknown;
  const hasVersion = !!(json && typeof json === 'object' && Object.prototype.hasOwnProperty.call(json as object, 'v'));
  const data = hasVersion ? (json as BM25Index) : (json as LegacyIndexItem[]);
  cachedIndex = { data, ts: now };
  return data;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qRaw = (url.searchParams.get('q') || '').trim();
  if (!qRaw) return NextResponse.json([] as Post[], { status: 200, headers: { 'Cache-Control': 'public, max-age=0, s-maxage=600' } });
  const q = qRaw.toLowerCase();
  const data = await loadIndex(req.url);
  if (Array.isArray(data)) {
    const results: Post[] = [];
    for (const item of data) {
      if (item.h.includes(q)) {
        results.push({
          path: item.path,
          slug: item.slug,
          title: item.title,
          date: item.date,
          timezone: item.timezone,
          excerpt: item.excerpt,
          content: '',
          tags: item.tags,
          author: item.author,
          thumbnail: item.thumbnail,
          width: (item.width || 'medium') as Post['width'],
        });
        if (results.length >= 50) break;
      }
    }
    return NextResponse.json(results, {
      status: 200,
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400' },
    });
  }

  const { N, avdl, df, vocab } = data as BM25Index;
  const k1 = 1.2;
  const b = 0.75;
  const tokens = q.split(/[^a-z0-9]+/).map(s => s.trim()).filter(s => s && s.length > 1);
  const termIds: number[] = [];
  const idf: number[] = [];
  for (const t of tokens) {
    const id = vocab[t];
    if (id == null) continue;
    termIds.push(id);
    const dfi = df[id] || 0;
    const val = Math.log((N - dfi + 0.5) / (dfi + 0.5) + 1);
    idf.push(val);
  }
  if (!termIds.length) return NextResponse.json([] as Post[], { status: 200 });

  const scored: Array<{ score: number; docId: number }> = [];
  if ((data as BM25IndexV3).postings) {
    const idx3 = data as BM25IndexV3;
    const scores = new Map<number, number>();
    for (let ti = 0; ti < termIds.length; ti++) {
      const tokId = termIds[ti];
      const idfVal = idf[ti];
      const plist = idx3.postings[tokId] || [];
      for (let i = 0; i < plist.length; i += 2) {
        const docId = plist[i];
        const tf = plist[i + 1];
        const dl = idx3.docs[docId].dl;
        const denom = tf + k1 * (1 - b + b * (dl / (avdl || 1)));
        const add = idfVal * ((tf * (k1 + 1)) / (denom || 1));
        scores.set(docId, (scores.get(docId) || 0) + add);
      }
    }
    for (const [docId, score] of scores) if (score > 0) scored.push({ score, docId });
    scored.sort((a, b2) => b2.score - a.score || ((idx3.docs[b2.docId].m.date > idx3.docs[a.docId].m.date) ? 1 : -1));
    const results: Post[] = scored.slice(0, 50).map(({ docId }) => {
      const d = idx3.docs[docId];
      return {
        path: d.m.path,
        slug: d.m.slug,
        title: d.m.title,
        date: d.m.date,
        timezone: d.m.timezone,
        excerpt: d.m.excerpt,
        content: '',
        tags: d.m.tags,
        author: d.m.author,
        thumbnail: d.m.thumbnail,
        width: (d.m.width || 'medium') as Post['width'],
      };
    });
    return NextResponse.json(results, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
      },
    });
  } else {
    const idx2 = data as BM25IndexV2;
    const scoredDocs: Array<{ score: number; doc: BM25IndexV2['docs'][number] }> = [];
    for (const doc of idx2.docs) {
      const { dl, t } = doc as unknown as { dl: number; t: number[] };
      let score = 0;
      for (let i = 0; i < t.length; i += 2) {
        const tokId = t[i];
        const tf = t[i + 1];
        const idx = termIds.indexOf(tokId);
        if (idx === -1) continue;
        const idfVal = idf[idx];
        const denom = tf + k1 * (1 - b + b * (dl / (avdl || 1)));
        score += idfVal * ((tf * (k1 + 1)) / (denom || 1));
      }
      if (score > 0) scoredDocs.push({ score, doc });
    }
    scoredDocs.sort((a, b2) => b2.score - a.score || ((b2.doc.m.date > a.doc.m.date) ? 1 : -1));
    const results: Post[] = scoredDocs.slice(0, 50).map(({ doc }) => ({
      path: doc.m.path,
      slug: doc.m.slug,
      title: doc.m.title,
      date: doc.m.date,
      timezone: doc.m.timezone,
      excerpt: doc.m.excerpt,
      content: '',
      tags: doc.m.tags,
      author: doc.m.author,
      thumbnail: doc.m.thumbnail,
      width: (doc.m.width || 'medium') as Post['width'],
    }));
    return NextResponse.json(results, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
      },
    });
  }
}
