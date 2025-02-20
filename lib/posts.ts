// lib/posts.ts
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const postsBinDir = path.join(process.cwd(), 'posts-bin');

export interface Post {
  slug: string;
  title: string;
  date: string;
  excerpt?: string;
  content: string;
  author: string;
  tags?: string[]; // Optional tags field
}

export function getAllPosts(): Post[] {
  const fileNames = fs.readdirSync(postsBinDir);
  return fileNames.map((fileName) => {
    const slug = fileName.replace(/\.md$/, '');
    const fullPath = path.join(postsBinDir, fileName);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);
    return {
      slug,
      title: data.title,
      date: data.date,
      excerpt: data.excerpt,
      content,
      tags: data.tags, // Return tags if provided
      author: data.author || 'Unknown Author', // Use default if not provided
    };
  });
}

export function getPostBySlug(slug: string): Post | null {
  const fullPath = path.join(postsBinDir, `${slug}.md`);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = matter(fileContents);
  return {
    slug,
    title: data.title,
    date: data.date,
    excerpt: data.excerpt,
    content,
    tags: data.tags,
    author: data.author || 'Unknown Author',
  };
}