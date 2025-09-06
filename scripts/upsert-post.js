// Plain Node.js upsert for a single markdown post with chunked content appends.
// Usage:
//   CF_ENV=prod node scripts/upsert-post.js posts/climate-change.md

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { spawnSync } = require('node:child_process');

function esc(v) { return v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`; }
function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function dateIso(dateField) {
  const parts = String(dateField || '').trim().split(/\s+/);
  if (parts.length < 1) throw new Error('Missing date');
  let tz = 'UTC';
  let head = parts[0];
  if (parts.length > 1) tz = parts.slice(1).join(' ');
  const d = new Date(head.includes('T') ? head : (head + 'T00:00:00Z'));
  if (isNaN(d.getTime())) throw new Error('Invalid date: ' + dateField);
  return { iso: d.toISOString(), timezone: tz };
}

function runWrangler(sql) {
  const binding = process.env.D1_BINDING || 'D1_POSTS';
  const envName = process.env.CF_ENV || 'prod';
  const args = ['wrangler','d1','execute',binding,'--command',sql,'--remote','--env', envName];
  const res = spawnSync('npx', args, { stdio: 'inherit' });
  if (res.status !== 0) throw new Error('wrangler failed');
}

function main() {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error('File not found:', file);
    process.exit(1);
  }
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = matter(raw) || { data: {}, content: '' };
  const data = parsed.data || {};
  const content = String(parsed.content || '').trim();

  const slug = slugify(path.basename(file).replace(/\.md$/,''));
  const { iso, timezone } = dateIso(data.date);
  const d = new Date(iso);
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2,'0');
  const pathSeg = `${yyyy}/${mm}/${slug}`;

  const statements = [];
  // Insert base row with empty content; on conflict update fields except content
  statements.push(`INSERT INTO posts (path,slug,type,title,author,excerpt,content,date_utc,timezone,width,thumbnail,download_url) VALUES (
    ${esc(pathSeg)}, ${esc(slug)}, 'markdown', ${esc(data.title || slug)}, ${esc(data.author || 'Unknown Author')}, ${esc(data.excerpt || null)}, '',
    ${esc(iso)}, ${esc(timezone)}, ${esc(data.width || 'medium')}, ${esc(data.thumbnail || null)}, ${esc(data.downloadUrl || null)}
  ) ON CONFLICT(path) DO UPDATE SET title=excluded.title,author=excluded.author,excerpt=excluded.excerpt,date_utc=excluded.date_utc,timezone=excluded.timezone,width=excluded.width,thumbnail=excluded.thumbnail,download_url=excluded.download_url;`);

  // Append content in chunks
  const chunkSize = 4000;
  for (let i=0;i<content.length;i+=chunkSize) {
    const part = content.slice(i,i+chunkSize).replace(/'/g, "''");
    statements.push(`UPDATE posts SET content = COALESCE(content,'') || '${part}' WHERE path=${esc(pathSeg)};`);
  }

  // Tags
  const tags = Array.isArray(data.tags) ? data.tags : (typeof data.tags === 'string' ? data.tags.split(/[,;]+/).map(s=>s.trim()).filter(Boolean) : []);
  for (const t of tags) {
    const safe = String(t).replace(/'/g, "''");
    statements.push(`INSERT INTO tags (name) VALUES ('${safe}') ON CONFLICT(name) DO NOTHING;`);
    statements.push(`INSERT INTO post_tags (post_id, tag_id) SELECT p.id, tg.id FROM posts p, tags tg WHERE p.path=${esc(pathSeg)} AND tg.name='${safe}' ON CONFLICT(post_id, tag_id) DO NOTHING;`);
  }

  const sql = statements.join('\n');
  console.log('Upserting', pathSeg);
  runWrangler(sql);
  console.log('Done.');
}

try { main(); } catch (e) { console.error(e); process.exit(1); }

