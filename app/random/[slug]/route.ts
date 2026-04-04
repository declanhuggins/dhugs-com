import { findAlbumBySlug, pickRandom } from '../pick';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const images = findAlbumBySlug(slug);
  if (!images || !images.length) {
    return new Response(`Album "${slug}" not found`, { status: 404 });
  }
  return pickRandom(images, new URL(request.url).searchParams);
}
