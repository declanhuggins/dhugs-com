// Plain Node.js ingester for markdown posts in ./posts -> Cloudflare D1
// Usage:
//   CF_ENV=dev node scripts/ingest-posts.js   (dev DB)
//   CF_ENV=prod node scripts/ingest-posts.js  (prod DB)

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { spawnSync } = require('node:child_process');

function esc(v) { return v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`; }

function parseDate(dateField) {
  const raw = String(dateField || '').trim();
  if (!raw) return { iso: new Date().toISOString(), tz: 'UTC' };
  const parts = raw.split(/\s+/);
  const head = parts[0];
  const tz = parts.slice(1).join(' ') || 'UTC';
  if (head.includes('T')) {
    const d = new Date(head);
    return { iso: isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(), tz };
  }
  return { iso: new Date(head + 'T00:00:00Z').toISOString(), tz };
}

function runWrangler(binding, sql) {
  const args = ['wrangler','d1','execute',binding,'--command',sql];
  const envName = process.env.CF_ENV || 'prod';
  args.push('--remote','--env', envName);
  const res = spawnSync('npx', args, { stdio: 'inherit' });
  if (res.status !== 0) throw new Error('wrangler failed');
}

function runMigrations(binding) {
  const args = ['wrangler','d1','migrations','apply', binding];
  const envName = process.env.CF_ENV || 'prod';
  args.push('--remote','--env', envName);
  const res = spawnSync('npx', args, { stdio: 'inherit' });
  if (res.status !== 0) throw new Error('wrangler migrations failed');
}

function main() {
  const postsDir = path.join(process.cwd(), 'posts');
  if (!fs.existsSync(postsDir)) {
    console.log('No posts directory found:', postsDir);
    return;
  }
  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
  function slugify(s) {
    return String(s)
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  const rows = [];
  for (const f of files) {
    const slug = slugify(f.replace(/\.md$/, ''));
    const raw = fs.readFileSync(path.join(postsDir, f), 'utf8');
    const parsed = matter(raw) || { data: {}, content: '' };
    const data = parsed.data || {};
    const content = String(parsed.content || '').trim();
    const { iso, tz } = parseDate(data.date);
    // Compute path = YYYY/MM/slug from UTC timestamp
    const d = new Date(iso);
    const yyyy = String(d.getUTCFullYear());
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const pathSeg = `${yyyy}/${mm}/${slug}`;
    rows.push({ slug, path: pathSeg, title: data.title || slug, author: data.author || 'Unknown Author', excerpt: data.excerpt || null, content, iso, tz, width: data.width || 'medium', thumbnail: data.thumbnail || null, downloadUrl: data.downloadUrl || null, tags: Array.isArray(data.tags) ? data.tags : [] });
  }
  if (!rows.length) { console.log('No markdown posts found.'); return; }
  const binding = process.env.D1_BINDING || 'D1_POSTS';
  // Ensure database schema is applied before ingesting
  runMigrations(binding);
  let count = 0;
  for (const r of rows) {
    const stmts = [];
    // Insert with empty content first to avoid oversized SQL literals, then append in chunks.
    stmts.push(`INSERT INTO posts (path,slug,type,title,author,excerpt,content,date_utc,timezone,width,thumbnail,download_url) VALUES (
      ${esc(r.path)}, ${esc(r.slug)}, 'markdown', ${esc(r.title)}, ${esc(r.author)}, ${esc(r.excerpt)}, '',
      ${esc(r.iso)}, ${esc(r.tz)}, ${esc(r.width)}, ${esc(r.thumbnail)}, ${esc(r.downloadUrl)}
    ) ON CONFLICT(path) DO UPDATE SET title=excluded.title, author=excluded.author, excerpt=excluded.excerpt,
      date_utc=excluded.date_utc, timezone=excluded.timezone, width=excluded.width, thumbnail=excluded.thumbnail, download_url=excluded.download_url;`);
    const chunkSize = 4000; // keep each SQL literal small
    const content = r.content;
    for (let i=0;i<content.length;i+=chunkSize) {
      const part = content.slice(i,i+chunkSize).replace(/'/g, "''");
      stmts.push(`UPDATE posts SET content = COALESCE(content,'') || '${part}' WHERE path=${esc(r.path)};`);
    }
    for (const t of r.tags) {
      const safe = String(t).replace(/'/g, "''");
      stmts.push(`INSERT INTO tags (name) VALUES ('${safe}') ON CONFLICT(name) DO NOTHING;`);
      stmts.push(`INSERT INTO post_tags (post_id, tag_id)
        SELECT p.id, tg.id FROM posts p, tags tg WHERE p.path=${esc(r.path)} AND tg.name='${safe}'
        ON CONFLICT(post_id, tag_id) DO NOTHING;`);
    }
    runWrangler(binding, stmts.join('\n'));
    count++;
  }
  console.log(`Ingested ${count} markdown post(s) to ${binding}${remote?' (remote)':''}.`);
}

try { main(); } catch (e) { console.error(e); process.exit(1); }
