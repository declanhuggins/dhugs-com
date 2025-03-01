import { NextResponse } from 'next/server';
import { getAllPosts } from '../../lib/posts-edge';

export const runtime = 'edge';

export default async function handler() {
  try {
    const posts = await getAllPosts();
    return NextResponse.json(posts, { status: 200 });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}
