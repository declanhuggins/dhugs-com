import { NextResponse } from 'next/server';
import { authenticateAdmin } from '../../../../lib/admin-auth';
import { getEnv } from '../../../../lib/cloudflare';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authError = await authenticateAdmin(request);
  if (authError) return authError;

  const body = (await request.json()) as { keys: string[] };
  if (!body.keys?.length) {
    return NextResponse.json({ error: 'keys[] required' }, { status: 400 });
  }

  const env = await getEnv();
  const deleted: string[] = [];

  for (const key of body.keys) {
    try {
      await env.R2_ASSETS.delete(key);
      deleted.push(key);
    } catch (e) {
      console.error(`Failed to delete ${key}:`, e);
    }
  }

  return NextResponse.json({ ok: true, deleted });
}
