import type { NextApiRequest, NextApiResponse } from 'next';

export const runtime = 'edge';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/posts-node`);
  const posts = await response.json();
  res.status(200).json(posts);
}
