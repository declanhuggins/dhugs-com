import albumIndex from '../../dist/data/album-index.json';

interface AlbumImage {
  largeURL: string;
  width: number;
  height: number;
}

type AlbumIdx = Record<string, AlbumImage[]>;

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

export function findAlbumBySlug(slug: string): AlbumImage[] | null {
  const idx = albumIndex as unknown as AlbumIdx;
  for (const [key, images] of Object.entries(idx)) {
    const parts = key.split('/');
    const albumSlug = parts[parts.length - 2];
    if (albumSlug === slug) return images;
  }
  return null;
}

export function allImages(): AlbumImage[] {
  return Object.values(albumIndex as unknown as AlbumIdx).flat();
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
