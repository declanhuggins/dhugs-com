import { allImages, pickRandom } from './pick';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const images = allImages();
  if (!images.length) {
    return new Response('No images available', { status: 404 });
  }
  return pickRandom(images, new URL(request.url).searchParams);
}
