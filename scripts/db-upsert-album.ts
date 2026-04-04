// db-upsert-album.ts — Upsert album metadata via admin API.
// Usage:
//   CF_ENV=dev tsx scripts/db-upsert-album.ts \
//     --slug apr-25 --title "April 25" --date "2025-04-25 America/Chicago" \
//     --author "Declan Huggins" --tags "Photography, Travel" --width large \
//     --thumbnail https://cdn.dhugs.com/o/2025/04/apr-25/thumbnail.avif

import { createInterface } from 'node:readline';
import { apiUpsertAlbum } from './lib/api-client';

function parseArgs(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : 'true';
      out[key] = val;
    }
  }
  return out;
}

function dateIso(dateField: string): { iso: string; timezone: string } {
  const parts = String(dateField).trim().split(/\s+/);
  if (parts.length < 2) throw new Error('Date must be "YYYY-MM-DD Timezone"');
  const head = parts[0];
  const tz = parts.slice(1).join(' ');
  let d: Date;
  if (head.includes('T')) {
    d = new Date(head);
  } else {
    // Default to 11:59 PM local time in the given timezone
    const guess = new Date(Date.UTC(+head.slice(0,4), +head.slice(5,7)-1, +head.slice(8,10), 23, 59));
    for (let i = 0; i < 3; i++) {
      const p = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
          timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', hour12: false,
        }).formatToParts(guess).map(x => [x.type, x.value])
      );
      const localMs = Date.UTC(+p.year, +p.month-1, +p.day, p.hour === '24' ? 0 : +p.hour, +p.minute);
      const wantMs = Date.UTC(+head.slice(0,4), +head.slice(5,7)-1, +head.slice(8,10), 23, 59);
      guess.setTime(guess.getTime() + (wantMs - localMs));
    }
    d = guess;
  }
  if (isNaN(d.getTime())) throw new Error('Invalid date: ' + head);
  return { iso: d.toISOString(), timezone: tz };
}

async function main() {
  const args = parseArgs();

  async function prompt(q: string): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(res => rl.question(q, ans => { rl.close(); res(ans); }));
  }

  if (!args.slug) args.slug = await prompt('Slug (e.g., apr-25): ');
  if (!args.title) args.title = await prompt('Title: ');
  if (!args.date) args.date = await prompt('Date (YYYY-MM-DD Timezone): ');
  if (!args.author) args.author = await prompt('Author: ');
  if (!args.width) args.width = (await prompt('Width (small|medium|large, default large): ')) || 'large';
  if (!args.tags) args.tags = await prompt('Tags (comma/semicolon separated, optional): ');
  if (!args.thumbnail) args.thumbnail = await prompt('Thumbnail URL (optional): ');
  if (!args.excerpt) args.excerpt = await prompt('Excerpt (optional): ');
  if (!args.downloadUrl) args.downloadUrl = await prompt('Download URL (optional): ');

  const tags = args.tags ? args.tags.split(/[,;]+/).map(s => s.trim()).filter(Boolean) : [];
  const { iso, timezone } = dateIso(args.date);

  console.log('Upserting album:', args.slug);

  const result = await apiUpsertAlbum({
    slug: args.slug,
    title: args.title,
    date_utc: iso,
    timezone,
    author: args.author,
    tags,
    excerpt: args.excerpt || undefined,
    thumbnail: args.thumbnail || undefined,
    download_url: args.downloadUrl || undefined,
    width: args.width || 'large',
  });

  console.log('Done:', result);
}

main().catch(e => { console.error(e); process.exit(1); });
