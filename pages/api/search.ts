import type { NextApiRequest, NextApiResponse } from 'next';
import searchData from '../../data/search-data.json';
import type { Post } from '../../lib/posts';

const { posts, index } = searchData as unknown as { posts: Post[]; index: Record<string, string[]> };


interface SearchIndex {
  [token: string]: string[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const query = (req.query.q as string | undefined)?.toLowerCase() || '';
    if (!query) {
      res.status(200).json([]);
      return;
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
  res.status(200).json(result);
  } catch (error) {
    console.error('Error searching posts:', error);
  res.status(500).json({ error: 'Failed to search posts' });
  }
}
