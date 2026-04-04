// Album images: queries R2 directly (at build time via wrangler proxy).
// No KV caching needed — pages are fully static.

import { queryAlbumImages } from './db';

export interface AlbumImage {
  filename: string;
  largeURL: string;
  thumbnailURL: string;
  width: number;
  height: number;
  alt: string;
}

export async function getAlbumImages(albumName: string): Promise<AlbumImage[]> {
  return queryAlbumImages(albumName);
}
