// Posts module: Handles retrieval and merging of markdown and album posts using Edge-compatible APIs.

import data from '../data/search-data.json';

export interface Post {
  slug: string;
  title: string;
  date: string;
  timezone: string;
  excerpt?: string;
  content?: string;
  author: string;
  tags?: string[];
  thumbnail?: string;
  width?: 'small' | 'medium' | 'large';
  downloadUrl?: string;
}

const posts: Post[] = (data as unknown as { posts: Post[] }).posts;

// Retrieve all posts
export async function getAllPosts(): Promise<Post[]> {
  console.log('Fetching all posts');
  return posts.map(post => ({
    ...post,
    width: post.width as 'small' | 'medium' | 'large' | undefined
  }));
}

// Retrieve a post based on the slug
export async function getPostBySlug(slug: string): Promise<Post | null> {
  console.log(`Fetching post with slug: ${slug}`);
  const post = posts.find((post) => post.slug === slug);
  return post ? { ...post, width: post.width as 'small' | 'medium' | 'large' | undefined } : null;
}