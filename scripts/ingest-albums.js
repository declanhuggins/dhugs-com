// Plain Node.js ingester for albums JSON -> Cloudflare D1, avoiding tsx/ESM loaders.
// Usage:
//   CF_ENV=dev node scripts/ingest-albums.js   (dev DB)
//   CF_ENV=prod node scripts/ingest-albums.js  (prod DB)
//   D1_BINDING defaults to D1_POSTS

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('node:child_process');

function esc(v) { return v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`; }

function scanAlbums(root) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  (function walk(dir){
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const st = fs.statSync(full);
      if (st.isDirectory()) { walk(full); continue; }
      if (!entry.endsWith('.json')) continue;
      const rel = path.relative(root, full).split(path.sep);
      if (rel.length !== 3) continue; // year/month/slug.json
      const [year, month, file] = rel;
      const slug = file.replace(/\.json$/, '');
      try {
        const meta = JSON.parse(fs.readFileSync(full, 'utf8')) || {};
        const dateStr = String(meta.date || '').trim();
        const parts = dateStr.split(/\s+/);
        const head = parts[0] || '2000-01-01';
        const tz = parts.slice(1).join(' ') || 'UTC';
        let iso;
        if (head.includes('T')) {
          const d = new Date(head);
          iso = isNaN(d.getTime()) ? new Date('2000-01-01T00:00:00Z').toISOString() : d.toISOString();
        } else {
          iso = new Date(head + 'T00:00:00Z').toISOString();
        }
        const pathSeg = `${year}/${month}/${slug}`;
        out.push({
          slug,
          path: pathSeg,
          title: meta.title || slug,
          author: meta.author || 'Unknown Author',
          excerpt: meta.excerpt || null,
          date_utc: iso,
          timezone: tz,
          width: meta.width || 'large',
          thumbnail: process.env.CDN_SITE ? `${process.env.CDN_SITE}/albums/${year}/${month}/${slug}/thumbnail.avif` : null,
          downloadUrl: meta.downloadUrl || null,
          tags: Array.isArray(meta.tags) ? meta.tags : [],
        });
      } catch (e) {
        console.warn('Failed to parse', full, e.message);
      }
    }
  })(root);
  return out;
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
  const albumsDir = path.join(process.cwd(), 'albums');
  const rows = scanAlbums(albumsDir);
  if (!rows.length) {
    console.log('No album JSON found in', albumsDir);
    return;
  }
  const binding = process.env.D1_BINDING || 'D1_POSTS';
  // Ensure database schema is applied before ingesting
  runMigrations(binding);
  const statements = [];
  for (const r of rows) {
    statements.push(`INSERT INTO posts (path,slug,type,title,author,excerpt,content,date_utc,timezone,width,thumbnail,download_url) VALUES (
      ${esc(r.path)}, ${esc(r.slug)}, 'album', ${esc(r.title)}, ${esc(r.author)}, ${esc(r.excerpt)}, '',
      ${esc(r.date_utc)}, ${esc(r.timezone)}, ${esc(r.width)}, ${esc(r.thumbnail)}, ${esc(r.downloadUrl)}
    ) ON CONFLICT(path) DO UPDATE SET title=excluded.title, author=excluded.author, excerpt=excluded.excerpt,
      date_utc=excluded.date_utc, timezone=excluded.timezone, width=excluded.width, thumbnail=excluded.thumbnail, download_url=excluded.download_url;`);
    for (const t of r.tags || []) {
      const safe = String(t).replace(/'/g, "''");
      statements.push(`INSERT INTO tags (name) VALUES ('${safe}') ON CONFLICT(name) DO NOTHING;`);
      statements.push(`INSERT INTO post_tags (post_id, tag_id)
        SELECT p.id, tg.id FROM posts p, tags tg WHERE p.path=${esc(r.path)} AND tg.name='${safe}'
        ON CONFLICT(post_id, tag_id) DO NOTHING;`);
    }
  }
  // chunk
  const chunk = 50;
  for (let i=0;i<statements.length;i+=chunk) {
    const sql = statements.slice(i,i+chunk).join('\n');
    runWrangler(binding, sql);
  }
  console.log(`Ingested ${rows.length} album(s) to ${binding}${remote?' (remote)':''}.`);
}

try { main(); } catch (e) { console.error(e); process.exit(1); }
