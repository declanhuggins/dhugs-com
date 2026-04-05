// Posts module: D1 queries cached through in-memory + KV layer.
// Prevents repeated D1 hits on RSC navigations and cache misses.

import { kvGet } from './kv-cache';
import { queryAllPosts, queryPostByPath } from './db';

export function getAuthorSlug(author: string): string {
  return author.toLowerCase().replace(/\s+/g, '-');
}

export function getProperAuthorName(slug: string): string {
  return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export interface Post {
  slug: string;
  path?: string;
  title: string;
  date: string;
  timezone: string;
  excerpt?: string;
  content: string;
  author: string;
  tags?: string[];
  thumbnail?: string;
  width?: 'small' | 'medium' | 'large';
  downloadUrl?: string;
  updatedAt?: string;
}

export async function getAllPosts(): Promise<Post[]> {
  return kvGet<Post[]>('posts:all', queryAllPosts);
}

export async function getPostByPath(pathSeg: string): Promise<Post | null> {
  return kvGet<Post | null>(`post:${pathSeg}`, () => queryPostByPath(pathSeg));
}
