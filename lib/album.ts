// Album images: R2 queries cached through in-memory + KV layer.

import { kvGet } from './kv-cache';
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
  const normalized = albumName.replace(/\/+$/, '');
  return kvGet<AlbumImage[]>(`album:${normalized}`, () => queryAlbumImages(albumName));
}
