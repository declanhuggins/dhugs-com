import { NextResponse } from 'next/server';
import { authenticateAdmin } from '../../../../lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authError = await authenticateAdmin(request);
  if (authError) return authError;

  // With fully static pages, there's nothing to revalidate at runtime.
  // Content updates require a new deploy (which rebuilds all static pages,
  // the search index, and the random image list from fresh D1/R2 data).
  return NextResponse.json({
    ok: true,
    message: 'Static site — deploy to update content. D1 writes via /api/admin/posts and /api/admin/albums are immediate.',
  });
}
