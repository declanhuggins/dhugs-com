// Search index — cached in KV to avoid rebuilding on every request.
import { buildSearchIndex } from '../../../lib/db';
import { kvGet } from '../../../lib/kv-cache';

export async function GET() {
  const index = await kvGet('search-index', buildSearchIndex);

  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300, s-maxage=31536000',
    },
  });
}
