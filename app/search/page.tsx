'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import PostGrid from '../components/PostGrid';
import type { Post } from '../../lib/posts';

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
  width?: 'small' | 'medium' | 'large';
};
type PackedDoc = { m: DocMeta; dl: number };
type BM25IndexV3 = { v: 3; N: number; avdl: number; df: number[]; vocab: Record<string, number>; postings: number[][]; docs: PackedDoc[] };
type LegacyIndexItem = DocMeta & { h: string };

const k1 = 1.2;
const b = 0.75;

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(s => s.trim())
    .filter(s => s.length > 1);
}

async function loadIndex(): Promise<BM25IndexV3 | LegacyIndexItem[]> {
  const res = await fetch('/search-index.json', { cache: 'force-cache' });
  if (!res.ok) return [] as LegacyIndexItem[];
  const json = await res.json();
  return json as BM25IndexV3 | LegacyIndexItem[];
}

function scoreV3(idx: BM25IndexV3, terms: string[]): Post[] {
  const termIds: number[] = [];
  const idf: number[] = [];
  for (const t of terms) {
    const id = idx.vocab[t];
    if (id == null) continue;
    termIds.push(id);
    const dfi = idx.df[id] || 0;
    idf.push(Math.log((idx.N - dfi + 0.5) / (dfi + 0.5) + 1));
  }
  if (!termIds.length) return [];
  const scores = new Map<number, number>();
  for (let ti = 0; ti < termIds.length; ti++) {
    const tokId = termIds[ti];
    const idfVal = idf[ti];
    const plist = idx.postings[tokId] || [];
    for (let i = 0; i < plist.length; i += 2) {
      const docId = plist[i];
      const tf = plist[i + 1];
      const dl = idx.docs[docId].dl;
      const denom = tf + k1 * (1 - b + b * (dl / (idx.avdl || 1)));
      const add = idfVal * ((tf * (k1 + 1)) / (denom || 1));
      scores.set(docId, (scores.get(docId) || 0) + add);
    }
  }
  const ranked = Array.from(scores.entries())
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1] || ((idx.docs[b[0]].m.date > idx.docs[a[0]].m.date) ? 1 : -1))
    .slice(0, 50)
    .map(([docId]) => idx.docs[docId].m as Post);
  return ranked;
}

function scoreLegacy(list: LegacyIndexItem[], terms: string[]): Post[] {
  const q = terms.join(' ');
  const out: Post[] = [];
  for (const item of list) if (item.h.includes(q)) {
    out.push({
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
    if (out.length >= 50) break;
  }
  return out;
}

let indexCache: BM25IndexV3 | LegacyIndexItem[] | null = null;

function isV3Index(idx: BM25IndexV3 | LegacyIndexItem[] | null): idx is BM25IndexV3 {
  return !!idx && typeof (idx as BM25IndexV3).v === 'number' && Array.isArray((idx as BM25IndexV3).docs);
}

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const query = searchParams ? searchParams.get('q') || '' : '';
  const [posts, setPosts] = useState<Post[]>([]);
  const loading = useRef(false);

  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!indexCache && !loading.current) {
        loading.current = true;
        try { indexCache = await loadIndex(); } finally { loading.current = false; }
      }
      const terms = tokenize(query);
      if (!indexCache || !mounted) return;
      const results = isV3Index(indexCache)
        ? scoreV3(indexCache, terms)
        : scoreLegacy(indexCache as LegacyIndexItem[], terms);
      if (mounted) setPosts(results);
    }
    run();
    return () => { mounted = false; };
  }, [query]);

  const title = useMemo(() => (
    <h1 className="text-2xl font-bold mb-4">Search Results for &quot;{query}&quot;</h1>
  ), [query]);

  return (
    <div>
      {title}
      <PostGrid posts={posts} />
    </div>
  );
}

export default function SearchResults() {
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <SearchResultsContent />
      </Suspense>
    </div>
  );
}
