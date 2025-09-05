// One-time utility to rebuild posts, tags, and post_tags with sequential ids.
// - Posts ordered by date_utc ASC get ids starting at 1
// - Tags ordered alphabetically (case-insensitive) get ids starting at 1
// - post_tags remapped via (posts.path, tags.name)
// Usage:
//   CF_ENV=dev node scripts/reset-ids.js
//   CF_ENV=prod node scripts/reset-ids.js

const { spawnSync } = require('node:child_process');

function run(sql) {
  const binding = process.env.D1_BINDING || 'D1_POSTS';
  const envName = process.env.CF_ENV || 'prod';
  const args = ['wrangler','d1','execute',binding,'--command', sql, '--remote','--env', envName];
  const res = spawnSync('npx', args, { encoding: 'utf8' });
  if (res.status !== 0) {
    console.error(res.stderr || 'wrangler failed');
    process.exit(1);
  }
  return res.stdout;
}

function main() {
  const sql = `
PRAGMA foreign_keys=OFF;

-- Build new posts table with desired id ordering
CREATE TABLE posts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  date_utc TEXT NOT NULL,
  timezone TEXT NOT NULL,
  width TEXT NOT NULL,
  thumbnail TEXT,
  download_url TEXT
);
INSERT INTO posts_new (path, slug, type, title, author, excerpt, content, date_utc, timezone, width, thumbnail, download_url)
SELECT path, slug, type, title, author, excerpt, content, date_utc, timezone, width, thumbnail, download_url
FROM posts
ORDER BY date_utc ASC, id ASC;

-- Build new tags table with alphabetical ordering
CREATE TABLE tags_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);
INSERT INTO tags_new (name)
SELECT name FROM tags ORDER BY name COLLATE NOCASE ASC, id ASC;

-- Build new post_tags with unique constraint
CREATE TABLE post_tags_new (
  post_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  UNIQUE(post_id, tag_id)
);
INSERT INTO post_tags_new (post_id, tag_id)
SELECT pn.id, tn.id
FROM post_tags pt
JOIN posts p ON p.id = pt.post_id
JOIN tags t ON t.id = pt.tag_id
JOIN posts_new pn ON pn.path = p.path
JOIN tags_new tn ON tn.name = t.name;

-- Swap tables
DROP TABLE post_tags;
DROP TABLE tags;
DROP TABLE posts;

ALTER TABLE posts_new RENAME TO posts;
ALTER TABLE tags_new RENAME TO tags;
ALTER TABLE post_tags_new RENAME TO post_tags;

PRAGMA foreign_keys=ON;
`;

  console.log('About to reset IDs for posts and tags (this rewrites tables).');
  console.log('Target env:', process.env.CF_ENV || 'prod');
  run(sql);
  console.log('Done: IDs reset and post_tags remapped.');
}

try { main(); } catch (e) { console.error(e); process.exit(1); }

