// db-upsert-post.ts
// Upsert a markdown post directly into D1 (Option B: DB-first authoring)
// Usage examples:
//   CF_ENV=dev tsx scripts/db-upsert-post.ts posts/new-article.md
//   CF_ENV=prod tsx scripts/db-upsert-post.ts posts/new-article.md
// The markdown file MUST have frontmatter:
// ---\n title: My Title\n date: 2025-08-27 America/Chicago\n tags: [Tag One, Tag Two]\n excerpt: Short blurb\n author: Declan Huggins\n width: medium\n thumbnail: https://cdn.example.com/... (optional)\n downloadUrl: https://... (optional)\n ---
// Content body after frontmatter is stored as full content.

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { execa } from 'execa';
import { createInterface } from 'node:readline';

function esc(v: unknown): string { return v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`; }

async function main() {
  async function prompt(q: string): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(res => rl.question(q, ans => { rl.close(); res(ans); }));
  }

  let file = process.argv[2];
  while (!file || !fs.existsSync(file)) {
    const entered = await prompt('Path to markdown file: ');
    if (!entered) continue;
    if (!fs.existsSync(entered)) { console.error('File not found:', entered); continue; }
    file = entered;
  }
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = matter(raw) as any;
  const data = parsed.data || {};
  const content = parsed.content.trim();
  // Derive slug from filename (without extension) using improved rules
  function slugify(s: string): string {
    return String(s)
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  const slug = slugify(path.basename(file).replace(/\.md$/,''));
  const required = ['title','date','author'];
  for (const r of required) if (!data[r]) { console.error(`Missing required frontmatter field: ${r}`); process.exit(1); }
  const tags: string[] = Array.isArray(data.tags) ? data.tags : (typeof data.tags === 'string' ? data.tags.split(/[,;]+/).map((s:string)=>s.trim()).filter(Boolean) : []);
  const binding = process.env.D1_BINDING || 'D1_POSTS';
  const envName = process.env.CF_ENV || 'prod';

  // Compute path from UTC parts of date
  const d = new Date(dateIso(data.date).iso);
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2,'0');
  const pathSeg = `${yyyy}/${mm}/${slug}`;

  // Insert with empty content first to avoid oversized SQL literals, then append in chunks.
  const cdn = process.env.CDN_SITE || '';
  const defaultThumb = data.thumbnail || (cdn ? `${cdn}/o/${yyyy}/${mm}/${slug}/thumbnail.avif` : undefined);
  const insertPost = `INSERT INTO posts (path,slug,type,title,author,excerpt,content,date_utc,timezone,width,thumbnail,download_url)
    VALUES (
      ${esc(pathSeg)},
      ${esc(slug)},
      'markdown',
      ${esc(data.title)},
      ${esc(data.author)},
      ${esc(data.excerpt)},
      '',
      ${esc(dateIso(data.date).iso)},
      ${esc(dateIso(data.date).timezone)},
      ${esc(data.width || 'medium')},
      ${esc(defaultThumb)},
      ${esc(data.downloadUrl)}
    ) ON CONFLICT(path) DO UPDATE SET title=excluded.title,author=excluded.author,excerpt=excluded.excerpt,date_utc=excluded.date_utc,timezone=excluded.timezone,width=excluded.width,thumbnail=excluded.thumbnail,download_url=excluded.download_url;`;

  const tagSql: string[] = [];
  for (const t of tags) {
    const safeTag = t.replace(/'/g,"''");
    tagSql.push(`INSERT INTO tags (name) VALUES ('${safeTag}') ON CONFLICT(name) DO NOTHING;`);
    tagSql.push(`INSERT INTO post_tags (post_id, tag_id)
      SELECT p.id, tg.id FROM posts p, tags tg WHERE p.path=${esc(pathSeg)} AND tg.name='${safeTag}' ON CONFLICT(post_id, tag_id) DO NOTHING;`);
  }

  const stmts: string[] = [insertPost];
  // Append content in safe chunks
  const chunkSize = 4000;
  for (let i = 0; i < content.length; i += chunkSize) {
    const part = content.slice(i, i + chunkSize).replace(/'/g, "''");
    stmts.push(`UPDATE posts SET content = COALESCE(content,'') || '${part}' WHERE path=${esc(pathSeg)};`);
  }
  stmts.push(...tagSql);

  const sql = stmts.join('\n');
  const args = ['wrangler','d1','execute',binding,'--command',sql,'--remote','--env', envName];

  console.log('Executing upsert for markdown post:', slug);
  await execa('npx', args, { stdio: 'inherit' });
  console.log('Done.');
}

function dateIso(dateField: string): { iso: string; timezone: string } {
  // Expect format 'YYYY-MM-DD TZ'
  const parts = String(dateField).trim().split(/\s+/);
  if (parts.length < 2) throw new Error('Date must be "YYYY-MM-DD Timezone"');
  const [ymd, tz] = [parts[0], parts.slice(1).join(' ')];
  // Leave ISO conversion to browser? Keep stored date_utc as "YYYY-MM-DDT00:00:00.000Z" by naive UTC interpretation.
  const iso = new Date(ymd + 'T00:00:00Z').toISOString();
  return { iso, timezone: tz };
}

main().catch(e => { console.error(e); process.exit(1); });
