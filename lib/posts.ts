// Posts module: Handles retrieval and merging of markdown and album posts.
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { toDate } from 'date-fns-tz';

export function getAuthorSlug(author: string): string {
  return author.toLowerCase().replace(/\s+/g, '-');
}

export function getProperAuthorName(slug: string): string {
  return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

const postsDir = path.join(process.cwd(), 'posts');

export interface Post {
  slug: string;
  title: string;
  date: string;
  excerpt?: string;
  content: string;
  author: string;
  tags?: string[];
  thumbnail?: string;
  width?: 'small' | 'medium' | 'large';
}

// Read posts from the posts directory.
export function getPostsFromBin(): Post[] {
  const fileNames = fs.readdirSync(postsDir);
  return fileNames.map((fileName) => {
    const slug = fileName.replace(/\.md$/, '');
    const fullPath = path.join(postsDir, fileName);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);
    const timeZone = process.env.Tz;
    const date = toDate(data.date, { timeZone }).toISOString();
    return {
      slug,
      title: data.title,
      date,
      excerpt: data.excerpt,
      content,
      tags: data.tags,
      author: data.author || 'Unknown Author',
      thumbnail: data.thumbnail || `${process.env.CDN_SITE}/medium/thumbnails/${slug}.avif`,
      width: data.width || 'medium', // Default to 'medium' if not specified
    };
  });
}

// Recursively search for album JSON files and convert them to Post objects.
function getAlbumPosts(): Post[] {
  const albumsDir = path.join(process.cwd(), 'albums');
  const results: Post[] = [];

  function walk(dir: string) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile() && path.extname(item).toLowerCase() === '.json') {
        const relativePath = path.relative(albumsDir, fullPath);
        const parts = relativePath.split(path.sep);
        if (parts.length === 3) {
          const [year, month, fileName] = parts;
          const slug = fileName.replace(/\.json$/, '');
          const fileContents = fs.readFileSync(fullPath, 'utf8');
          const data = JSON.parse(fileContents);
          const date = toDate(data.date, { timeZone: 'America/New_York' }).toISOString();
          const thumbnail = `${process.env.CDN_SITE}/medium/albums/${year}/${month}/${slug}/thumbnail.avif`;
          results.push({
            slug,
            title: data.title,
            date,
            excerpt: data.excerpt || '',
            content: '',
            tags: data.tags,
            author: data.author,
            thumbnail,
            width: data.width || 'large', // Default to 'large' if not specified
          });
        }
      }
    }
  }

  walk(albumsDir);
  return results;
}

// Merge markdown and album posts, sorted by date (newest first).
export function getAllPosts(): Post[] {
  const markdownPosts = getPostsFromBin();
  const albumPosts = getAlbumPosts();
  const allPosts = [...markdownPosts, ...albumPosts];
  return allPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Retrieve a post based on the slug from markdown or album posts.
export function getPostBySlug(slug: string): Post | null {
  const fullPath = path.join(postsDir, `${slug}.md`);
  if (fs.existsSync(fullPath)) {
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);
    const date = toDate(data.date, { timeZone: 'America/New_York' }).toISOString();
    return {
      slug: slug,
      title: data.title,
      date: date,
      excerpt: data.excerpt,
      content,
      tags: data.tags,
      author: data.author || 'Unknown Author',
      thumbnail: data.thumbnail || `${process.env.CDN_SITE}/medium/thumbnails/${slug}.avif`,
      width: data.width || 'medium', // Default to 'medium' if not specified
    };
  }
  const albumPosts = getAlbumPosts();
  const found = albumPosts.find(post => post.slug === slug);
  return found || null;
}