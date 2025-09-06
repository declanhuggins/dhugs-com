// Album images: Use a precomputed static index (public/album-index.json).
// Build must generate this file; runtime never lists R2.

export interface AlbumImage {
  filename: string;
  largeURL: string;
  thumbnailURL: string;
  width: number;
  height: number;
  alt: string;
}

// Minimal R2 bucket shapes (avoid full workers types dependency)
// Minimal R2 bucket shapes (for Worker runtime)
const albumCache = new Map<string, AlbumImage[]>();
type AlbumIndex = Record<string, AlbumImage[]>;

import albumIndexSnapshot from '../dist/data/album-index.json';

export async function getAlbumImages(albumName: string, force = false): Promise<AlbumImage[]> {
  if (!force && albumCache.has(albumName)) return albumCache.get(albumName)!;
  const idx = albumIndexSnapshot as unknown as AlbumIndex;
  const exact = idx[albumName];
  const fallback = idx[albumName.replace(/\/images\/?$/, '/')];
  const images = exact || fallback;
  if (!images) {
    throw new Error(`[album] Album '${albumName}' not found in precomputed index. Run 'npm run content:albumsIndex'.`);
  }
  albumCache.set(albumName, images);
  return images;
}
