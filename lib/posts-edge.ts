// Posts module: Handles retrieval and merging of markdown and album posts using Edge-compatible APIs.

export interface Post {
  slug: string;
  title: string;
  date: string;
  excerpt?: string;
  content: string;
  author: string;
  tags?: string[];
  thumbnail?: string;
}

// Mock data for posts
const posts: Post[] = [
  {
    slug: 'example-post',
    title: 'Example Post',
    date: '2023-01-01',
    excerpt: 'This is an example post.',
    content: 'This is the content of the example post.',
    author: 'Author Name',
    tags: ['example', 'post'],
    thumbnail: 'https://example.com/thumbnail.jpg',
  },
  // Add more mock posts as needed
];

// Retrieve all posts
export async function getAllPosts(): Promise<Post[]> {
  return posts;
}

// Retrieve a post based on the slug
export async function getPostBySlug(slug: string): Promise<Post | null> {
  const post = posts.find((post) => post.slug === slug);
  return post || null;
}
