import { NextResponse } from 'next/server';
import searchData from '../../data/search-data.json';
import type { Post } from '../../lib/posts-edge';

const { posts, index } = searchData as unknown as { posts: Post[]; index: Record<string, string[]> };

export const runtime = 'edge';

interface SearchIndex {
  [token: string]: string[];
}

export default async function handler(req: Request) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('q')?.toLowerCase() || '';
    if (!query) {
      return NextResponse.json([], { status: 200 });
    }

    const tokens = query.match(/[a-z0-9']+/g) || [];
    const counts: Record<string, number> = {};
    for (const token of tokens) {
      const slugs = (index as SearchIndex)[token] || [];
      for (const slug of slugs) {
        counts[slug] = (counts[slug] || 0) + 1;
      }
    }
    const matchedSlugs = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const result = posts.filter(p => matchedSlugs.includes(p.slug));
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error searching posts:', error);
    return NextResponse.json({ error: 'Failed to search posts' }, { status: 500 });
  }
}
