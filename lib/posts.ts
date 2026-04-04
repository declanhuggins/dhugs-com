// Posts module: queries D1 directly (at build time via wrangler proxy).
// No KV caching needed — pages are fully static.

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
  return queryAllPosts();
}

export async function getPostByPath(pathSeg: string): Promise<Post | null> {
  return queryPostByPath(pathSeg);
}
