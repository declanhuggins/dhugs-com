// db-upsert-post.ts — Upsert a markdown post via admin API.
// Usage:
//   CF_ENV=dev tsx scripts/db-upsert-post.ts posts/new-article.md
//   CF_ENV=prod tsx scripts/db-upsert-post.ts posts/new-article.md

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { createInterface } from 'node:readline';
import { apiUpsertPost } from './lib/api-client';

function slugify(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function dateIso(dateField: string): { iso: string; timezone: string } {
  const parts = String(dateField).trim().split(/\s+/);
  if (parts.length < 2) throw new Error('Date must be "YYYY-MM-DD Timezone"');
  const ymd = parts[0];
  const tz = parts.slice(1).join(' ');
  // Default to 11:59 PM local time in the given timezone
  const guess = new Date(Date.UTC(+ymd.slice(0,4), +ymd.slice(5,7)-1, +ymd.slice(8,10), 23, 59));
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(guess).map(x => [x.type, x.value])
    );
    const localMs = Date.UTC(+p.year, +p.month-1, +p.day, p.hour === '24' ? 0 : +p.hour, +p.minute);
    const wantMs = Date.UTC(+ymd.slice(0,4), +ymd.slice(5,7)-1, +ymd.slice(8,10), 23, 59);
    guess.setTime(guess.getTime() + (wantMs - localMs));
  }
  const iso = guess.toISOString();
  return { iso, timezone: tz };
}

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
  const parsed = matter(raw);
  const data = parsed.data || {};
  const content = parsed.content.trim();
  const slug = slugify(path.basename(file).replace(/\.md$/, ''));

  const required = ['title', 'date', 'author'];
  for (const r of required) {
    if (!data[r]) {
      console.error(`Missing required frontmatter field: ${r}`);
      process.exit(1);
    }
  }

  const tags: string[] = Array.isArray(data.tags)
    ? data.tags
    : (typeof data.tags === 'string' ? data.tags.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean) : []);

  const { iso, timezone } = dateIso(data.date);
  // Derive year/month from local date in the post's timezone (not UTC)
  const d = new Date(iso);
  const dateParts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, year: 'numeric', month: '2-digit',
    }).formatToParts(d).map(p => [p.type, p.value])
  );
  const yyyy = dateParts.year;
  const mm = dateParts.month;
  const postPath = `${yyyy}/${mm}/${slug}`;

  const cdn = process.env.CDN_SITE || 'https://cdn.dhugs.com';
  const thumbnail = data.thumbnail || `${cdn}/o/${yyyy}/${mm}/${slug}/thumbnail.avif`;

  console.log(`Upserting post: ${slug} -> ${postPath}`);

  const result = await apiUpsertPost({
    path: postPath,
    slug,
    type: 'markdown',
    title: data.title,
    author: data.author,
    date_utc: iso,
    timezone,
    excerpt: data.excerpt,
    content,
    width: data.width || 'medium',
    thumbnail,
    download_url: data.downloadUrl,
    tags,
  });

  console.log('Done:', result);
}

main().catch(e => { console.error(e); process.exit(1); });
