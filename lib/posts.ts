// Posts module: Handles retrieval and merging of markdown and album posts.
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fromZonedTime } from 'date-fns-tz';

export function getAuthorSlug(author: string): string {
  return author.toLowerCase().replace(/\s+/g, '-');
}

export function getProperAuthorName(slug: string): string {
  return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

const postsDir = path.join(process.cwd(), 'posts');

function parseDateWithTimezone(dateStr: string): { iso: string; timezone: string } {
  const [datePart, tz] = dateStr.split(' ');
  const utc = fromZonedTime(datePart, tz);
  return { iso: utc.toISOString(), timezone: tz };
}

export interface Post {
  slug: string;
  title: string;
  date: string;
  timezone: string;
  excerpt?: string;
  content: string;
  author: string;
  tags?: string[];
  thumbnail?: string;
  width?: 'small' | 'medium' | 'large';
  downloadUrl?: string;
}

interface AlbumJson {
  title: string;
  date: string; // Expect format 'YYYY-MM-DD TZ'
  excerpt?: string;
  tags?: string[];
  author: string;
  width?: 'small' | 'medium' | 'large';
  downloadUrl?: string;
}

// Read posts from the posts directory.
let markdownCache: Post[] | null = null;
export function getPostsFromBin(force = false): Post[] {
  if (!force && markdownCache) return markdownCache;
  const fileNames = fs.readdirSync(postsDir);
  const posts = fileNames.filter(f => f.endsWith('.md')).map((fileName) => {
    const slug = fileName.replace(/\.md$/, '');
    const fullPath = path.join(postsDir, fileName);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);
    const { iso, timezone } = parseDateWithTimezone(data.date);
    return {
      slug,
      title: data.title,
      date: iso,
      timezone,
      excerpt: data.excerpt,
      content,
      tags: data.tags,
      author: data.author || 'Unknown Author',
      thumbnail: data.thumbnail || `${process.env.CDN_SITE}/medium/thumbnails/${slug}.avif`,
      width: data.width || 'medium', // Default to 'medium' if not specified
    };
  });
  markdownCache = posts;
  return posts;
}

// Recursively search for album JSON files and convert them to Post objects.
let albumCache: Post[] | null = null;
function getAlbumPosts(force = false): Post[] {
  if (!force && albumCache) return albumCache;
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
        const relativePath = path.relative(albumsDir, fullPath).replace(/\\/g, '/');
        const parts = relativePath.split('/');
        if (parts.length === 3) {
          const [year, month, fileName] = parts;
          const slug = fileName.replace(/\.json$/, '');
          const fileContents = fs.readFileSync(fullPath, 'utf8');
          let data: AlbumJson;
          try {
            data = JSON.parse(fileContents) as AlbumJson;
          } catch (e) {
            console.error(`Failed to parse album JSON: ${fullPath}`, e);
            continue;
          }
          const { iso, timezone } = parseDateWithTimezone(data.date);
          const thumbnail = `${process.env.CDN_SITE}/medium/albums/${year}/${month}/${slug}/thumbnail.avif`;
          results.push({
            slug,
            title: data.title,
            date: iso,
            timezone,
            excerpt: data.excerpt || '',
            content: '',
            tags: data.tags,
            author: data.author,
            thumbnail,
            width: data.width || 'large', // Default to 'large' if not specified
            ...(data.downloadUrl ? { downloadUrl: data.downloadUrl } : {})
          });
        }
      }
    }
  }

  walk(albumsDir);
  albumCache = results;
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
    const { iso, timezone } = parseDateWithTimezone(data.date);
    return {
      slug: slug,
      title: data.title,
      date: iso,
      timezone,
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