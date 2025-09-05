import { NextApiRequest, NextApiResponse } from 'next';
import { getAllPosts } from '../../lib/posts';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const posts = await getAllPosts();
  res.status(200).json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
  res.status(500).json({ error: 'Failed to fetch posts' });
  }
}
