import { spawnSync } from 'node:child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env', quiet: true });

type Row = {
  path?: string;
  slug: string;
  title: string;
  author: string;
  excerpt?: string | null;
  content?: string | null;
  date: string;
  timezone: string;
  width?: string | null;
  thumbnail?: string | null;
  downloadUrl?: string | null;
  tags?: string | null;
};

function mapRow(r: Row) {
  let tags: string[] | undefined = undefined;
  if (r.tags != null) {
    const raw = String(r.tags).trim();
    try {
      if (raw.startsWith('[')) {
        const arr = JSON.parse(raw) as unknown[];
        tags = arr
          .map(v => String(v))
          .map(s => s.trim())
          .filter(s => s && !/^(null|undefined)$/i.test(s));
      } else if (raw.includes('||')) {
        tags = raw.split('||').map(s => s.trim()).filter(Boolean);
      } else if (raw.length) {
        tags = raw.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (tags && tags.length) tags = Array.from(new Set(tags));
    } catch {
      // ignore
    }
  }
  return {
    path: r.path || undefined,
    slug: r.slug,
    title: r.title,
    author: r.author,
    excerpt: r.excerpt || undefined,
    content: r.content || '',
    date: r.date,
    timezone: r.timezone,
    width: r.width || 'medium',
    thumbnail: r.thumbnail || undefined,
    downloadUrl: r.downloadUrl || undefined,
    tags,
  };
}

async function main() {
  const binding = process.env.D1_BINDING || 'D1_POSTS';
  const env = process.env.CF_ENV || 'prod';
  const SQL = `SELECT p.path,p.slug,p.type,p.title,p.author,p.excerpt,p.content,p.date_utc as date,p.timezone,p.width,p.thumbnail,p.download_url as downloadUrl, json_group_array(DISTINCT t.name) as tags
FROM posts p
LEFT JOIN post_tags pt ON pt.post_id=p.id
LEFT JOIN tags t ON t.id=pt.tag_id
GROUP BY p.id
ORDER BY p.date_utc DESC;`;
  const res = spawnSync('npx', ['wrangler','d1','execute',binding,'--command',SQL,'--json','--remote','--env', env], { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(res.stderr || 'wrangler failed');
  const parsed = JSON.parse(res.stdout || '[]');
  let rows: Row[] = [];
  if (Array.isArray(parsed)) {
    for (const part of parsed) {
      if (Array.isArray(part?.result)) rows = part.result as Row[];
      else if (Array.isArray(part?.results)) rows = part.results as Row[];
    }
  } else if (Array.isArray(parsed?.result)) rows = parsed.result as Row[];
  else if (Array.isArray(parsed?.results)) rows = parsed.results as Row[];
  const list = rows.map(mapRow);
  const outDir = path.join(process.cwd(), 'dist', 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'posts.json'), JSON.stringify(list));
  console.log(`Wrote ${list.length} posts to dist/data/posts.json`);
}

main().catch(err => { console.error(err); process.exit(1); });
