// Tests for the BM25 search index tokenization and scoring logic.
// These test the same algorithms used in lib/db.ts buildSearchIndex()
// and app/search/page.tsx scoreV3().
import { describe, it, expect } from 'vitest';

// Replicate the tokenizer from both db.ts and search/page.tsx
const STOP_WORDS = new Set([
  'a','an','and','are','as','at','be','but','by','for','if','in','into','is','it',
  'no','not','of','on','or','such','that','the','their','then','there','these',
  'they','this','to','was','will','with','you','your','i','we','our','from',
]);

function tokenize(text: string, weight = 1): string[] {
  if (!text) return [];
  const out: string[] = [];
  const s = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  for (const raw of s.split(' ')) {
    const tok = raw.trim();
    if (!tok || tok.length < 2 || STOP_WORDS.has(tok)) continue;
    for (let i = 0; i < weight; i++) out.push(tok);
  }
  return out;
}

describe('Search tokenizer', () => {
  it('lowercases and splits on non-alphanumeric', () => {
    expect(tokenize('Hello World')).toEqual(['hello', 'world']);
  });

  it('removes stop words', () => {
    expect(tokenize('the quick brown fox and the lazy dog'))
      .toEqual(['quick', 'brown', 'fox', 'lazy', 'dog']);
  });

  it('removes single-character tokens', () => {
    expect(tokenize('a b c d ee ff')).toEqual(['ee', 'ff']);
  });

  it('handles weight parameter', () => {
    const tokens = tokenize('photography', 3);
    expect(tokens).toEqual(['photography', 'photography', 'photography']);
  });

  it('handles empty input', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('handles special characters', () => {
    expect(tokenize("it's a wonderful life!")).toEqual(['wonderful', 'life']);
  });

  it('handles numbers', () => {
    expect(tokenize('2025 photos 42')).toEqual(['2025', 'photos', '42']);
  });
});

describe('BM25 scoring', () => {
  // Minimal BM25 implementation matching scoreV3 in search/page.tsx
  const k1 = 1.2;
  const b = 0.75;

  function buildMiniIndex(docs: Array<{ title: string; content: string }>) {
    const vocab = new Map<string, number>();
    const dfCounts: number[] = [];
    const docsTmp = docs.map(doc => {
      const tokens = [...tokenize(doc.title, 3), ...tokenize(doc.content, 1)];
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
      for (const tok of tf.keys()) {
        if (!vocab.has(tok)) { vocab.set(tok, vocab.size); dfCounts.push(0); }
      }
      return { tf, dl: tokens.length, title: doc.title };
    });
    for (const d of docsTmp) {
      for (const tok of d.tf.keys()) { dfCounts[vocab.get(tok)!] += 1; }
    }
    const N = docsTmp.length;
    const avdl = docsTmp.reduce((s, d) => s + d.dl, 0) / N;
    const postings: number[][] = Array.from({ length: vocab.size }, () => []);
    docsTmp.forEach((d, i) => {
      for (const [tok, freq] of d.tf.entries()) { postings[vocab.get(tok)!].push(i, freq); }
    });
    const vocabObj: Record<string, number> = {};
    for (const [tok, id] of vocab.entries()) vocabObj[tok] = id;
    return { N, avdl, df: dfCounts, vocab: vocabObj, postings, docs: docsTmp.map(d => ({ title: d.title, dl: d.dl })) };
  }

  function score(idx: ReturnType<typeof buildMiniIndex>, query: string): Array<{ title: string; score: number }> {
    const terms = tokenize(query);
    const results = new Map<number, number>();
    for (const term of terms) {
      const tokId = idx.vocab[term];
      if (tokId == null) continue;
      const dfi = idx.df[tokId] || 0;
      const idf = Math.log((idx.N - dfi + 0.5) / (dfi + 0.5) + 1);
      const plist = idx.postings[tokId];
      for (let i = 0; i < plist.length; i += 2) {
        const docId = plist[i];
        const tf = plist[i + 1];
        const dl = idx.docs[docId].dl;
        const denom = tf + k1 * (1 - b + b * (dl / (idx.avdl || 1)));
        results.set(docId, (results.get(docId) || 0) + idf * ((tf * (k1 + 1)) / (denom || 1)));
      }
    }
    return Array.from(results.entries())
      .filter(([, s]) => s > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([docId, s]) => ({ title: idx.docs[docId].title, score: s }));
  }

  it('ranks exact title matches highest', () => {
    const idx = buildMiniIndex([
      { title: 'Kylemore Abbey', content: 'A beautiful abbey in Connemara' },
      { title: 'Croagh Patrick Hike', content: 'Hiking up the holy mountain with abbey views' },
      { title: 'Dublin City Walk', content: 'Walking through Dublin streets' },
    ]);
    const results = score(idx, 'Kylemore Abbey');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Kylemore Abbey');
  });

  it('returns empty for no matching terms', () => {
    const idx = buildMiniIndex([
      { title: 'Photography', content: 'Camera and lens discussion' },
    ]);
    expect(score(idx, 'basketball')).toEqual([]);
  });

  it('ranks documents with higher term frequency higher', () => {
    const idx = buildMiniIndex([
      { title: 'Ireland Photos', content: 'Ireland is green and Ireland is beautiful' },
      { title: 'Travel Notes', content: 'Visited Ireland once' },
    ]);
    const results = score(idx, 'ireland');
    expect(results.length).toBe(2);
    expect(results[0].title).toBe('Ireland Photos');
  });

  it('title terms are weighted 3x', () => {
    const idx = buildMiniIndex([
      { title: 'Photography Gallery', content: 'Some random content here' },
      { title: 'Random Article', content: 'This article discusses photography in detail' },
    ]);
    const results = score(idx, 'photography');
    expect(results[0].title).toBe('Photography Gallery');
  });
});
