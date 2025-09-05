// db-upsert-album.ts
// Upsert an album-style post directly into D1 using simple CLI flags (Option B DB-first authoring).
// Usage:
//   tsx scripts/db-upsert-album.ts \
//     --slug apr-25 --title "April 25" --date "2025-04-25 America/Chicago" \
//     --author "Declan Huggins" --tags "Photography, Travel" --width large \
//     --thumbnail https://cdn.dhugs.com/albums/2025/04/apr-25/thumbnail.avif
// Env: CF_ENV=dev|prod selects DB (default prod)
// Flags:
//   --slug (required)
//   --title (required)
//   --date "YYYY-MM-DD Timezone" (required)
//   --author (required)
//   --excerpt (optional)
//   --tags comma or semicolon list (optional)
//   --width small|medium|large (optional, default large)
//   --thumbnail url (optional)
//   --downloadUrl url (optional)

import { execa } from 'execa';
import { createInterface } from 'node:readline';

function parseArgs(): Record<string,string> {
  const out: Record<string,string> = {};
  for (let i=2;i<process.argv.length;i++) {
    const a = process.argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = process.argv[i+1] && !process.argv[i+1].startsWith('--') ? process.argv[++i] : 'true';
      out[key] = val;
    }
  }
  return out;
}

function esc(v: unknown): string { return v == null ? 'NULL' : `'${String(v).replace(/'/g,"''")}'`; }

async function main() {
  const args = parseArgs();
  async function prompt(q: string): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(res => rl.question(q, ans => { rl.close(); res(ans); }));
  }

  // Prompt for any missing required fields
  if (!args.slug) args.slug = await prompt('Slug (e.g., apr-25): ');
  if (!args.title) args.title = await prompt('Title: ');
  if (!args.date) args.date = await prompt('Date (YYYY-MM-DD Timezone): ');
  if (!args.author) args.author = await prompt('Author: ');
  if (!args.width) args.width = (await prompt('Width (small|medium|large, default large): ')) || 'large';
  if (!args.tags) args.tags = await prompt('Tags (comma/semicolon separated, optional): ');
  if (!args.thumbnail) args.thumbnail = await prompt('Thumbnail URL (optional): ');
  if (!args.excerpt) args.excerpt = await prompt('Excerpt (optional): ');
  if (!args.downloadUrl) args.downloadUrl = await prompt('Download URL (optional): ');

  const slug = args.slug;
  const tags = args.tags ? args.tags.split(/[,;]+/).map(s=>s.trim()).filter(Boolean) : [];
  const binding = process.env.D1_BINDING || 'D1_POSTS';
  const envName = process.env.CF_ENV || 'prod';

  // Compute path from UTC parts of date
  const d = new Date(dateIso(args.date).iso);
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2,'0');
  const pathSeg = `${yyyy}/${mm}/${slug}`;

  const insert = `INSERT INTO posts (path,slug,type,title,author,excerpt,content,date_utc,timezone,width,thumbnail,download_url)
    VALUES (
      ${esc(pathSeg)},
      ${esc(slug)},
      'album',
      ${esc(args.title)},
      ${esc(args.author)},
      ${esc(args.excerpt)},
      '',
      ${esc(dateIso(args.date).iso)},
      ${esc(dateIso(args.date).timezone)},
      ${esc(args.width || 'large')},
      ${esc(args.thumbnail)},
      ${esc(args.downloadUrl)}
    ) ON CONFLICT(path) DO UPDATE SET title=excluded.title,author=excluded.author,excerpt=excluded.excerpt,date_utc=excluded.date_utc,timezone=excluded.timezone,width=excluded.width,thumbnail=excluded.thumbnail,download_url=excluded.download_url;`;

  const tagSql: string[] = [];
  for (const t of tags) {
    const safe = t.replace(/'/g,"''");
    tagSql.push(`INSERT INTO tags (name) VALUES ('${safe}') ON CONFLICT(name) DO NOTHING;`);
    tagSql.push(`INSERT INTO post_tags (post_id, tag_id) SELECT p.id, tg.id FROM posts p, tags tg WHERE p.path=${esc(pathSeg)} AND tg.name='${safe}' ON CONFLICT(post_id, tag_id) DO NOTHING;`);
  }
  const sql = [insert, ...tagSql].join('\n');
  const execArgs = ['wrangler','d1','execute',binding,'--command',sql,'--remote','--env', envName];
  console.log('Upserting album:', slug);
  await execa('npx', execArgs, { stdio: 'inherit' });
  console.log('Done.');
}

function dateIso(dateField: string): { iso: string; timezone: string } {
  const parts = String(dateField).trim().split(/\s+/);
  if (parts.length < 2) throw new Error('Date must be "YYYY-MM-DD Timezone" or "ISO Timezone"');
  const head = parts[0];
  const tz = parts.slice(1).join(' ');
  let iso: string;
  if (head.includes('T')) {
    const d = new Date(head);
    if (isNaN(d.getTime())) throw new Error('Invalid ISO timestamp: ' + head);
    iso = d.toISOString();
  } else {
    const d = new Date(head + 'T00:00:00Z');
    if (isNaN(d.getTime())) throw new Error('Invalid date: ' + head);
    iso = d.toISOString();
  }
  return { iso, timezone: tz };
}

main().catch(e => { console.error(e); process.exit(1); });
