import './env-init.ts';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fromZonedTime } from 'date-fns-tz';

/** Front‑matter shape for markdown posts */
interface FrontMatter {
  title: string;
  date: string; // e.g. "2024-05-20 America/Los_Angeles" OR ISO (fallback UTC)
  excerpt?: string;
  tags?: string[];
  author?: string;
  thumbnail?: string;
  width?: PostWidth;
}

type PostWidth = 'small' | 'medium' | 'large';

export interface Post {
  slug: string;
  title: string;
  date: string; // ISO string
  timezone: string;
  excerpt: string;
  content: string;
  tags?: string[];
  author: string;
  thumbnail: string;
  width: PostWidth | string; // allow unknown future values
}

interface SearchData {
  posts: Omit<Post, 'content'>[];
  index: Record<string, string[]>; // token -> slugs
}

/** Small utility for narrowing to string */
function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

const postsDir = path.join(process.cwd(), 'posts');
const albumsDir = path.join(process.cwd(), 'albums');
const outputDir = path.join(process.cwd(), 'data');
const outputFile = path.join(outputDir, 'search-data.json');

/**
 * Accepts strings like "2024-05-20 America/Los_Angeles" OR an ISO date.
 * If no timezone provided, defaults to UTC.
 */
function parseDateWithTimezone(dateStr: string | undefined): { iso: string; timezone: string } {
  if (!dateStr) {
    const now = new Date();
    return { iso: now.toISOString(), timezone: 'UTC' };
  }
  const parts = dateStr.trim().split(/\s+/);
  const datePart = parts[0];
  const tz = parts[1] || 'UTC';
  try {
    // If datePart already includes time zone offset (e.g., 2024-05-20T10:00:00Z) treat as ISO directly.
    if (datePart.includes('T')) {
      const d = new Date(datePart);
      if (!isNaN(d.getTime())) return { iso: d.toISOString(), timezone: tz };
    }
    const utc = fromZonedTime(datePart, tz);
    return { iso: utc.toISOString(), timezone: tz };
  } catch {
    const fallback = new Date(dateStr);
    if (!isNaN(fallback.getTime())) return { iso: fallback.toISOString(), timezone: tz };
    const now = new Date();
    return { iso: now.toISOString(), timezone: tz };
  }
}

const cdnSite = process.env.CDN_SITE;

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Read posts from the posts directory
function getPostsFromBin(): Post[] {
  if (!fs.existsSync(postsDir)) return [];
  const fileNames = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
  return fileNames.map<Post>((fileName) => {
    const slug = fileName.replace(/\.md$/, '');
    const fullPath = path.join(postsDir, fileName);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    // gray-matter(fileContents) returns { data, content }
    const { data, content } = matter(fileContents) as unknown as { data: FrontMatter; content: string };
    const { iso, timezone } = parseDateWithTimezone(data.date);
    return {
      slug,
      title: str(data.title, slug),
      date: iso,
      timezone,
      excerpt: str(data.excerpt),
      content,
      tags: Array.isArray(data.tags) ? data.tags : undefined,
      author: str(data.author, 'Unknown Author'),
      thumbnail: data.thumbnail || (cdnSite ? `${cdnSite}/medium/thumbnails/${slug}.avif` : ''),
      width: (data.width as PostWidth | undefined) || 'medium',
    };
  });
}

// Recursively search for album JSON files and convert them to Post objects
function getAlbumPosts(): Post[] {
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
          try {
            const data = JSON.parse(fileContents) as Partial<FrontMatter> & { date?: string };
            const { iso, timezone } = parseDateWithTimezone(data.date);
            const thumbnail = cdnSite ? `${cdnSite}/medium/albums/${year}/${month}/${slug}/thumbnail.avif` : '';
            results.push({
              slug,
              title: str(data.title, slug),
              date: iso,
              timezone,
              excerpt: str(data.excerpt),
              content: '',
              tags: Array.isArray(data.tags) ? data.tags : undefined,
              author: str(data.author, 'Unknown Author'),
              thumbnail,
              width: (data.width as PostWidth | undefined) || 'large',
            });
          } catch (e) {
            console.error(`Failed to parse album JSON: ${fullPath}`, e);
          }
        }
      }
    }
  }

  if (fs.existsSync(albumsDir)) {
    walk(albumsDir);
  }
  return results;
}

// Merge markdown and album posts, sorted by date (newest first)
function getAllPosts(): Post[] {
  const markdownPosts = getPostsFromBin();
  const albumPosts = getAlbumPosts();
  const allPosts = [...markdownPosts, ...albumPosts];
  return allPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Gather all posts and build search data
const posts = getAllPosts();

// Build a simple inverted search index
function buildSearchIndex(posts: Post[]): Record<string, string[]> {
  const index: Record<string, string[]> = {};
  for (const post of posts) {
    const text = `${post.title} ${post.content}`.toLowerCase();
    const tokens = text.match(/[a-z0-9']+/g) || [];
    const unique = [...new Set(tokens.filter(t => t.length > 2 && !/^\d+$/.test(t)))];
    for (const token of unique) {
      (index[token] ||= []).push(post.slug);
    }
  }
  return index;
}

const searchIndex = buildSearchIndex(posts);
const postsMeta: Omit<Post, 'content'>[] = posts.map(({ content, ...rest }) => rest);
const searchData: SearchData = { posts: postsMeta, index: searchIndex };

try {
  fs.writeFileSync(outputFile, JSON.stringify(searchData, null, 2));
  console.log(`Pre-compiled search data written to ${outputFile}`);
} catch (e) {
  console.error('Failed writing search data:', e);
  process.exitCode = 1;
}

if (!cdnSite) {
  console.warn('Warning: CDN_SITE environment variable not set; thumbnails may be blank.');
}
