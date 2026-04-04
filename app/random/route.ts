import { loadAllImages, pickRandom } from './pick';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const images = await loadAllImages();
  if (!images.length) {
    return Response.json({ error: 'No images available' }, { status: 404 });
  }
  return pickRandom(images, new URL(request.url).searchParams);
}
