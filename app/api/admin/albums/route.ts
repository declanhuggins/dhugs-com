import { NextResponse } from 'next/server';
import { authenticateAdmin } from '../../../../lib/admin-auth';
import { upsertPost, type PostInput } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

interface AlbumInput {
  slug: string;
  title: string;
  date_utc: string;
  timezone: string;
  author: string;
  tags?: string[];
  excerpt?: string;
  thumbnail?: string;
  download_url?: string;
  width?: string;
}

export async function POST(request: Request) {
  const authError = await authenticateAdmin(request);
  if (authError) return authError;

  const body = (await request.json()) as AlbumInput;
  if (!body.slug || !body.title || !body.date_utc) {
    return NextResponse.json({ error: 'slug, title, and date_utc are required' }, { status: 400 });
  }

  const d = new Date(body.date_utc);
  const tz = body.timezone || 'America/New_York';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit',
    }).formatToParts(d).map(p => [p.type, p.value])
  );
  const year = parts.year;
  const month = parts.month;
  const path = `${year}/${month}/${body.slug}`;

  const postInput: PostInput = {
    path,
    slug: body.slug,
    type: 'album',
    title: body.title,
    author: body.author,
    date_utc: body.date_utc,
    timezone: tz,
    excerpt: body.excerpt,
    content: '',
    width: body.width || 'large',
    thumbnail: body.thumbnail,
    download_url: body.download_url,
    tags: body.tags,
  };

  try {
    await upsertPost(postInput);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('upsertPost failed:', msg);
    return NextResponse.json({ error: 'upsertPost failed: ' + msg }, { status: 500 });
  }

  // Static pages and search index update on next deploy
  return NextResponse.json({ ok: true, path });
}
