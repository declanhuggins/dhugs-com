// Random image picker — uses build-time data only, zero KV reads.
// The image list is computed during static generation via getAllPosts + getAlbumImages.

import { getAllPosts } from '../../lib/posts';
import { getAlbumImages } from '../../lib/album';

interface AlbumImage {
  largeURL: string;
  width: number;
  height: number;
}

const SIZE_PREFIXES: Record<string, string> = {
  o: '/o/',
  original: '/o/',
  l: '/l/',
  large: '/l/',
  m: '/m/',
  medium: '/m/',
  s: '/s/',
  small: '/s/',
};

function filterByOrientation(images: AlbumImage[], orientation: string): AlbumImage[] {
  switch (orientation) {
    case 'landscape':
      return images.filter(i => i.width > i.height);
    case 'portrait':
      return images.filter(i => i.height > i.width);
    case 'square':
      return images.filter(i => i.width === i.height);
    default:
      return images;
  }
}

// Build the full image list once at module load (during build or first request).
// Since the random route is force-dynamic, this runs in the Worker — but only once
// per cold start, not per request.
let cachedImages: AlbumImage[] | null = null;

async function loadAllImages(): Promise<AlbumImage[]> {
  if (cachedImages) return cachedImages;

  const posts = await getAllPosts();
  const albumPosts = posts.filter(p => !p.content);
  const all: AlbumImage[] = [];

  for (const p of albumPosts) {
    if (!p.path) continue;
    try {
      const images = await getAlbumImages(`o/${p.path}/images`);
      all.push(...images);
    } catch { /* skip */ }
  }

  try {
    const portfolio = await getAlbumImages('o/portfolio/images');
    all.push(...portfolio);
  } catch { /* skip */ }

  cachedImages = all;
  return all;
}

export async function findAlbumBySlug(slug: string): Promise<AlbumImage[] | null> {
  const posts = await getAllPosts();
  const albumPosts = posts.filter(p => !p.content);
  for (const p of albumPosts) {
    if (p.slug === slug && p.path) {
      try {
        return await getAlbumImages(`o/${p.path}/images`);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function pickRandom(images: AlbumImage[], searchParams: URLSearchParams): Response {
  const orientation = searchParams.get('orientation') ?? '';
  const size = searchParams.get('size') ?? 'o';
  const prefix = SIZE_PREFIXES[size.toLowerCase()] ?? '/o/';

  const filtered = orientation ? filterByOrientation(images, orientation.toLowerCase()) : images;

  if (!filtered.length) {
    return new Response('No images match the requested filters', { status: 404 });
  }

  const chosen = filtered[Math.floor(Math.random() * filtered.length)];
  const url = chosen.largeURL.replace('/l/', prefix);

  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      'Cache-Control': 'no-store',
    },
  });
}

export { loadAllImages };
