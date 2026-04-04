// Runtime D1 query functions — replaces build-time wrangler CLI snapshots.
// Returns empty data during build when bindings aren't available.
import { getEnv, getEnvSafe } from './cloudflare';
import type { Post } from './posts';
import type { AlbumImage } from './album';
import { CDN_BASE } from './constants';

// ---------------------------------------------------------------------------
// Row → Post mapping (ported from lib/posts.ts)
// ---------------------------------------------------------------------------

type RowShape = Record<string, unknown>;

function mapRowToPost(r: RowShape): Post {
  const rawDl = r.downloadUrl ?? r.download_url;
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
        for (const v of r.tags as unknown[]) {
          const s = String(v).trim();
          if (!s) continue;
          if (s.startsWith('[')) {
            try {
              for (const a of JSON.parse(s) as unknown[]) {
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
        const parts = s.includes('||') ? s.split('||') : s.split(',');
        tags = parts.map(x => x.trim()).filter(x => x && !/^(null|undefined)$/i.test(x));
      }
      if (tags?.length) tags = Array.from(new Set(tags));
    } catch {
      tags = undefined;
    }
  }

  const slug = String(r.slug ?? '');
  const dateStr = String(r.date ?? r.date_utc ?? '');
  let thumb: string | undefined = r.thumbnail ? String(r.thumbnail) : undefined;
  if (!thumb && slug && dateStr) {
    const d = new Date(dateStr);
    const tz = String(r.timezone || 'America/New_York');
    const dp = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit' })
        .formatToParts(d).map(p => [p.type, p.value])
    );
    thumb = `${CDN_BASE}/o/${dp.year}/${dp.month}/${slug}/thumbnail.avif`;
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
    updatedAt: r.updated_at ? String(r.updated_at).replace(/ /, 'T') + (String(r.updated_at).includes('Z') ? '' : 'Z') : undefined,
  };
}

// ---------------------------------------------------------------------------
// D1 Queries
// ---------------------------------------------------------------------------

const ALL_POSTS_SQL = `
  SELECT p.path, p.slug, p.type, p.title, p.author, p.excerpt, p.content,
         p.date_utc as date, p.timezone, p.width, p.thumbnail, p.download_url,
         p.updated_at,
         json_group_array(DISTINCT t.name) as tags
  FROM posts p
  LEFT JOIN post_tags pt ON pt.post_id = p.id
  LEFT JOIN tags t ON t.id = pt.tag_id
  GROUP BY p.id
  ORDER BY p.date_utc DESC
`;

export async function queryAllPosts(): Promise<Post[]> {
  const env = await getEnvSafe();
  if (!env?.D1_POSTS) return []; // Build time — no bindings available
  const result = await env.D1_POSTS.prepare(ALL_POSTS_SQL).all();
  return (result.results as RowShape[]).map(mapRowToPost);
}

export async function queryPostByPath(path: string): Promise<Post | null> {
  const env = await getEnvSafe();
  if (!env?.D1_POSTS) return null; // Build time
  const sql = `
    SELECT p.path, p.slug, p.type, p.title, p.author, p.excerpt, p.content,
           p.date_utc as date, p.timezone, p.width, p.thumbnail, p.download_url,
           p.updated_at,
           json_group_array(DISTINCT t.name) as tags
    FROM posts p
    LEFT JOIN post_tags pt ON pt.post_id = p.id
    LEFT JOIN tags t ON t.id = pt.tag_id
    WHERE p.path = ?
    GROUP BY p.id
  `;
  const result = await env.D1_POSTS.prepare(sql).bind(path).first<RowShape>();
  return result ? mapRowToPost(result) : null;
}

// ---------------------------------------------------------------------------
// Album Images — R2 listing with manifest fallback
// ---------------------------------------------------------------------------

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.avif']);

function getCdnBase(): string {
  return CDN_BASE.replace(/\/+$/, '');
}

export async function queryAlbumImages(albumName: string): Promise<AlbumImage[]> {
  const env = await getEnvSafe();
  if (!env?.R2_ASSETS) return []; // Build time
  const cdnBase = getCdnBase();

  // Try reading a _manifest.json from R2 first (single request, smallest latency)
  try {
    const manifestKey = `${albumName}/_manifest.json`.replace(/\/+/g, '/');
    const obj = await env.R2_ASSETS.get(manifestKey);
    if (obj) {
      const json = (await obj.json()) as { images?: Array<{ filename: string; width?: number; height?: number; alt?: string }> };
      if (json.images?.length) {
        return json.images.map(it => {
          const base = `${cdnBase}/${albumName}/${it.filename}`.replace(/([^:])\/+\/+/g, '$1/');
          return {
            filename: it.filename,
            largeURL: base.replace(/\/o\//, '/l/'),
            thumbnailURL: base.replace(/\/o\//, '/m/'),
            width: Number(it.width || 1600),
            height: Number(it.height || 900),
            alt: it.alt || it.filename,
          };
        });
      }
    }
  } catch {
    // Manifest not found — fall through to R2 list
  }

  // Fall back to listing R2 objects
  const prefix = albumName.endsWith('/') ? albumName : `${albumName}/`;
  const images: AlbumImage[] = [];
  let cursor: string | undefined;

  do {
    const listed = await env.R2_ASSETS.list({ prefix, cursor });
    for (const obj of listed.objects) {
      const key = obj.key;
      if (key.endsWith('/_meta.json') || key.endsWith('/_manifest.json')) continue;
      const dot = key.lastIndexOf('.');
      const ext = dot >= 0 ? key.slice(dot).toLowerCase() : '';
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;

      const filename = key.replace(prefix, '');
      const w = Number(obj.customMetadata?.width) || 1600;
      const h = Number(obj.customMetadata?.height) || 900;
      const base = `${cdnBase}/${albumName}/${filename}`.replace(/([^:])\/+\/+/g, '$1/');
      images.push({
        filename,
        largeURL: base.replace(/\/o\//, '/l/'),
        thumbnailURL: base.replace(/\/o\//, '/m/'),
        width: w,
        height: h,
        alt: obj.customMetadata?.alt || filename,
      });
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  if (!images.length) {
    // Fallback: include just the thumbnail so album pages don't break
    const thumbBase = `${cdnBase}/${albumName.replace(/\/images\/?$/, '')}/thumbnail.avif`.replace(/([^:])\/+\/+/g, '$1/');
    images.push({
      filename: 'thumbnail.avif',
      largeURL: thumbBase.replace(/\/o\//, '/l/'),
      thumbnailURL: thumbBase.replace(/\/o\//, '/m/'),
      width: 1600,
      height: 900,
      alt: 'thumbnail',
    });
  }

  return images;
}

// ---------------------------------------------------------------------------
// D1 Mutations (for admin API)
// ---------------------------------------------------------------------------

export interface PostInput {
  path: string;
  slug: string;
  type: 'markdown' | 'album';
  title: string;
  author: string;
  date_utc: string;
  timezone: string;
  excerpt?: string;
  content?: string;
  width?: string;
  thumbnail?: string;
  download_url?: string;
  tags?: string[];
}

export async function upsertPost(input: PostInput): Promise<void> {
  const env = await getEnv();
  const db = env.D1_POSTS;

  await db
    .prepare(
      `INSERT INTO posts (path, slug, type, title, author, excerpt, content, date_utc, timezone, width, thumbnail, download_url, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(path) DO UPDATE SET
         slug=excluded.slug, type=excluded.type, title=excluded.title,
         author=excluded.author, excerpt=excluded.excerpt, content=excluded.content,
         date_utc=excluded.date_utc, timezone=excluded.timezone, width=excluded.width,
         thumbnail=excluded.thumbnail, download_url=excluded.download_url,
         updated_at=datetime('now')`,
    )
    .bind(
      input.path, input.slug, input.type, input.title, input.author,
      input.excerpt ?? null, input.content ?? null, input.date_utc,
      input.timezone, input.width ?? 'medium', input.thumbnail ?? null,
      input.download_url ?? null,
    )
    .run();

  // Handle tags
  if (input.tags?.length) {
    // Get the post ID
    const row = await db.prepare('SELECT id FROM posts WHERE path = ?').bind(input.path).first<{ id: number }>();
    if (!row) return;

    // Remove existing tags
    await db.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(row.id).run();

    // Insert tags
    for (const tagName of input.tags) {
      await db
        .prepare('INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING')
        .bind(tagName)
        .run();
      const tagRow = await db.prepare('SELECT id FROM tags WHERE name = ?').bind(tagName).first<{ id: number }>();
      if (tagRow) {
        await db
          .prepare('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?) ON CONFLICT DO NOTHING')
          .bind(row.id, tagRow.id)
          .run();
      }
    }
  }
}

export async function deletePost(path: string): Promise<boolean> {
  const env = await getEnv();
  const db = env.D1_POSTS;

  const row = await db.prepare('SELECT id FROM posts WHERE path = ?').bind(path).first<{ id: number }>();
  if (!row) return false;

  await db.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(row.id).run();
  await db.prepare('DELETE FROM posts WHERE id = ?').bind(row.id).run();
  return true;
}

// ---------------------------------------------------------------------------
// Search Index Builder (ported from scripts/generate-search-index.ts)
// ---------------------------------------------------------------------------

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

function normalizeStr(str: unknown): string {
  // eslint-disable-next-line no-control-regex
  return (str == null ? '' : String(str)).replace(/\u0000/g, '').trim();
}

export interface SearchIndex {
  v: 3;
  N: number;
  avdl: number;
  df: number[];
  vocab: Record<string, number>;
  postings: number[][];
  docs: Array<{ m: Record<string, unknown>; dl: number }>;
}

export async function buildSearchIndex(): Promise<SearchIndex> {
  const env = await getEnvSafe();
  if (!env?.D1_POSTS) {
    return { v: 3, N: 0, avdl: 0, df: [], vocab: {}, postings: [], docs: [] };
  }
  const sql = `
    SELECT p.path, p.slug, p.title, p.author, p.excerpt, p.content,
           p.date_utc as date, p.timezone, p.width, p.thumbnail,
           json_group_array(DISTINCT t.name) as tags
    FROM posts p
    LEFT JOIN post_tags pt ON pt.post_id = p.id
    LEFT JOIN tags t ON t.id = pt.tag_id
    GROUP BY p.id
    ORDER BY p.date_utc DESC
  `;
  const result = await env.D1_POSTS.prepare(sql).all();
  const rows = result.results as RowShape[];

  // Build per-document token frequencies
  const docsTmp = rows.map(r => {
    // Parse tags
    let tagsArr: string[] = [];
    if (r.tags != null) {
      const raw = String(r.tags).trim();
      try {
        if (raw.startsWith('[')) {
          tagsArr = (JSON.parse(raw) as unknown[])
            .map(v => String(v).trim())
            .filter(s => s && !/^(null|undefined)$/i.test(s));
        } else if (raw.includes('||')) {
          tagsArr = raw.split('||').map(s => s.trim()).filter(Boolean);
        } else if (raw.length) {
          tagsArr = raw.split(',').map(s => s.trim()).filter(Boolean);
        }
        if (tagsArr.length) tagsArr = Array.from(new Set(tagsArr));
      } catch { /* ignore */ }
    }

    const tokens = [
      ...tokenize(normalizeStr(r.title), 3),
      ...tokenize(normalizeStr(r.author), 1),
      ...tagsArr.flatMap(t => tokenize(t, 2)),
      ...tokenize(normalizeStr(r.excerpt), 1),
      ...tokenize(normalizeStr(r.content), 1),
    ];
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);

    const meta = {
      path: r.path || undefined,
      slug: r.slug,
      title: r.title,
      date: r.date ?? r.date_utc,
      timezone: r.timezone,
      excerpt: r.excerpt || undefined,
      author: r.author,
      tags: tagsArr.length ? tagsArr : undefined,
      thumbnail: r.thumbnail || undefined,
      width: r.width || undefined,
    };

    return { tf, dl: tokens.length, meta };
  });

  const N = docsTmp.length || 1;
  const avdl = docsTmp.reduce((s, d) => s + d.dl, 0) / N;

  // Build vocabulary
  const vocab = new Map<string, number>();
  const dfCounts: number[] = [];
  for (const d of docsTmp) {
    for (const tok of d.tf.keys()) {
      if (!vocab.has(tok)) {
        vocab.set(tok, vocab.size);
        dfCounts.push(0);
      }
    }
  }

  // Count document frequency per token
  for (const d of docsTmp) {
    for (const tok of d.tf.keys()) {
      dfCounts[vocab.get(tok)!] += 1;
    }
  }

  // Build inverted postings lists
  const postings: number[][] = Array.from({ length: vocab.size }, () => []);
  const docs = docsTmp.map((d, docIndex) => {
    for (const [tok, freq] of d.tf.entries()) {
      postings[vocab.get(tok)!].push(docIndex, freq);
    }
    return { m: d.meta as Record<string, unknown>, dl: d.dl };
  });

  const vocabObj: Record<string, number> = {};
  for (const [tok, id] of vocab.entries()) vocabObj[tok] = id;

  return { v: 3, N, avdl, df: dfCounts, vocab: vocabObj, postings, docs };
}
