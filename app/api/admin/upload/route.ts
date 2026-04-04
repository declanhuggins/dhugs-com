import { NextResponse } from 'next/server';
import { authenticateAdmin } from '../../../../lib/admin-auth';
import { getEnv } from '../../../../lib/cloudflare';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authError = await authenticateAdmin(request);
  if (authError) return authError;

  const formData = await request.formData();
  const results: Array<{ key: string; size: number }> = [];

  for (const [fieldName, value] of formData.entries()) {
    if (!(value instanceof File)) continue;

    const key = formData.get(`${fieldName}_key`) as string | null
      ?? formData.get('key') as string | null;

    if (!key) {
      return NextResponse.json(
        { error: `Missing key for file '${fieldName}'` },
        { status: 400 },
      );
    }

    const env = await getEnv();
    const buffer = await value.arrayBuffer();

    const widthStr = formData.get(`${fieldName}_width`) as string | null;
    const heightStr = formData.get(`${fieldName}_height`) as string | null;
    const alt = formData.get(`${fieldName}_alt`) as string | null;

    const customMetadata: Record<string, string> = {};
    if (widthStr) customMetadata.width = widthStr;
    if (heightStr) customMetadata.height = heightStr;
    if (alt) customMetadata.alt = alt;

    // Thumbnails change when the user re-tags — use short cache so CDN doesn't serve stale.
    // Album images are immutable, so they can cache longer.
    const isThumbnail = key.includes('/thumbnail.');
    const cacheControl = isThumbnail
      ? 'public, max-age=60, s-maxage=60'
      : 'public, max-age=31536000, immutable';

    await env.R2_ASSETS.put(key, buffer, {
      httpMetadata: {
        contentType: value.type || 'application/octet-stream',
        cacheControl,
      },
      customMetadata,
    });

    results.push({ key, size: buffer.byteLength });
  }

  if (!results.length) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, uploaded: results });
}
