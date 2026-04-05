import { NextResponse } from 'next/server';
import { authenticateAdmin } from '../../../../lib/admin-auth';
import { upsertPost, deletePost, type PostInput } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authError = await authenticateAdmin(request);
  if (authError) return authError;

  const body = (await request.json()) as PostInput;
  if (!body.path || !body.title) {
    return NextResponse.json({ error: 'path and title are required' }, { status: 400 });
  }

  await upsertPost(body);

  // Static pages and search index update on next deploy
  return NextResponse.json({ ok: true, path: body.path });
}

export async function DELETE(request: Request) {
  const authError = await authenticateAdmin(request);
  if (authError) return authError;

  const { path } = (await request.json()) as { path: string };
  if (!path) {
    return NextResponse.json({ error: 'path is required' }, { status: 400 });
  }

  const deleted = await deletePost(path);
  if (!deleted) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, deleted: path });
}
