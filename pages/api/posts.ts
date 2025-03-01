import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllPosts } from '../../lib/posts';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const posts = getAllPosts();
  res.status(200).json(posts);
}
