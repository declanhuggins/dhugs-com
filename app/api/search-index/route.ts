// Search index — built at build time as a static response, zero KV reads.
// Rebuilt on every deploy (when D1 data is fresh).
import { buildSearchIndex } from '../../../lib/db';

export async function GET() {
  const index = await buildSearchIndex();

  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300, s-maxage=31536000',
    },
  });
}
