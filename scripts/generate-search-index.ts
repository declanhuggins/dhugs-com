import fs from 'fs';
import path from 'path';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';

dotenv.config({ path: '.env', quiet: true });

type Row = {
  path?: string;
  slug: string;
  title: string;
  date: string;
  timezone: string;
  excerpt?: string | null;
  content?: string | null;
  author: string;
  tags?: string | null;
  thumbnail?: string | null;
  width?: string | null;
};

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
  width?: string;
};

type PackedDoc = {
  m: DocMeta;     // metadata for result display
  dl: number;     // document length (token count)
};

function normalize(str: unknown): string {
  const s = (str == null ? '' : String(str));
  return s.replace(/\u0000/g, '').trim();
}

const STOP = new Set([
  'a','an','and','are','as','at','be','but','by','for','if','in','into','is','it','no','not','of','on','or','such','that','the','their','then','there','these','they','this','to','was','will','with','you','your','i','we','our','from'
]);

function tokenize(text: string, weight = 1): string[] {
  if (!text) return [];
  const out: string[] = [];
  const s = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  for (const raw of s.split(' ')) {
    const tok = raw.trim();
    if (!tok || tok.length < 2 || STOP.has(tok)) continue;
    for (let i = 0; i < weight; i++) out.push(tok);
  }
  return out;
}

function buildDocTokens(r: Row): { tf: Map<string, number>; dl: number; meta: DocMeta } {
  const tagsArr = (r.tags ? String(r.tags).split('||').filter(Boolean) : []) as string[];
  const title = normalize(r.title);
  const excerpt = normalize(r.excerpt);
  const content = normalize(r.content);
  const author = normalize(r.author);
  const tokens = [
    ...tokenize(title, 3),      // boost title
    ...tokenize(author, 1),
    ...tagsArr.flatMap(t => tokenize(t, 2)),
    ...tokenize(excerpt, 1),
    ...tokenize(content, 1),
  ];
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  const meta: DocMeta = {
    path: r.path || undefined,
    slug: r.slug,
    title: r.title,
    date: r.date,
    timezone: r.timezone,
    excerpt: r.excerpt || undefined,
    author: r.author,
    tags: tagsArr.length ? tagsArr : undefined,
    thumbnail: r.thumbnail || undefined,
    width: r.width || undefined,
  };
  return { tf, dl: tokens.length, meta };
}

async function main() {
  const binding = process.env.D1_BINDING || 'D1_POSTS';
  const remote = ['--remote', '-e', (process.env.CF_ENV || 'prod')];
  const SQL = `SELECT p.path,p.slug,p.title,p.author,p.excerpt,p.content,p.date_utc as date,p.timezone,p.width,p.thumbnail,
    json_group_array(DISTINCT t.name) as tags
  FROM posts p
  LEFT JOIN post_tags pt ON pt.post_id=p.id
  LEFT JOIN tags t ON t.id=pt.tag_id
  GROUP BY p.id
  ORDER BY p.date_utc DESC;`;
  const cmd = ['wrangler','d1','execute',binding,'--command', SQL.replace(/\s+/g,' ').trim(),'--json',...remote];
  const res = spawnSync('npx', cmd, { encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(res.stderr || 'wrangler failed');
  }
  const parsed = JSON.parse(res.stdout || '[]');
  let rows: Row[] = [];
  if (Array.isArray(parsed)) {
    for (const part of parsed) {
      if (Array.isArray((part as any)?.result)) rows = (part as any).result as Row[];
      else if (Array.isArray((part as any)?.results)) rows = (part as any).results as Row[];
    }
  } else if (Array.isArray((parsed as any)?.result)) {
    rows = ((parsed as any).result as Row[]) || [];
  } else if (Array.isArray((parsed as any)?.results)) {
    rows = ((parsed as any).results as Row[]) || [];
  }
  // Build BM25-ish index with inverted postings
  const docsTmp = rows.map(buildDocTokens);
  const N = docsTmp.length || 1;
  const avdl = docsTmp.reduce((s, d) => s + d.dl, 0) / N;
  // vocab: token -> id; df: id -> doc frequency
  const vocab = new Map<string, number>();
  const dfCounts: number[] = [];
  for (const d of docsTmp) {
    for (const tok of d.tf.keys()) {
      let id = vocab.get(tok);
      if (id == null) {
        id = vocab.size;
        vocab.set(tok, id);
        dfCounts[id] = 0;
      }
    }
  }
  // Count DF per token
  for (const d of docsTmp) {
    for (const tok of d.tf.keys()) {
      const id = vocab.get(tok)!;
      dfCounts[id] += 1;
    }
  }
  // Initialize postings lists
  const postings: number[][] = Array.from({ length: vocab.size }, () => []);
  // Pack docs and fill postings
  const docs: PackedDoc[] = docsTmp.map((d, docIndex) => {
    for (const [tok, freq] of d.tf.entries()) {
      const id = vocab.get(tok)!;
      const list = postings[id];
      list.push(docIndex, freq);
    }
    return { m: d.meta, dl: d.dl };
  });
  // Build string->id dictionary
  const vocabObj: Record<string, number> = {};
  for (const [tok, id] of vocab.entries()) vocabObj[tok] = id;

  const index = { v: 3, N, avdl, df: dfCounts, vocab: vocabObj, postings, docs };
  const outDir = path.join(process.cwd(), 'public');
  const outPath = path.join(outDir, 'search-index.json');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(index));
  console.log(`Search index written to ${outPath} (${docs.length} items, vocab=${Object.keys(vocabObj).length})`);
}

main().catch(err => {
  console.error('Error generating search index:', err);
  process.exit(1);
});
