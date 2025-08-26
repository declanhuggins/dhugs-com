// Posts module: Handles retrieval and merging of markdown and album posts.
import path from 'path';
import { fromZonedTime } from 'date-fns-tz';
// Soft-import Node-only modules so Edge runtime doesn't choke – use eval to prevent static analysis bundling.
let fs: typeof import('fs') | undefined;
let matter: typeof import('gray-matter') | undefined;
// Use Function constructor to avoid triggering bundler static require detection.
try { fs = (Function('return typeof require!="undefined" ? require("fs") : undefined'))() as typeof import('fs') | undefined; } catch { fs = undefined; }
try { matter = (Function('return typeof require!="undefined" ? require("gray-matter") : undefined'))() as typeof import('gray-matter') | undefined; } catch { matter = undefined; }
// Precompiled metadata (always available at build time)
// Using dynamic import with assert prevents commonjs require lint violations.
import precompiledData from '../data/search-data.json';
interface PrecompiledMeta { slug: string; title: string; date: string; timezone: string; excerpt?: string; tags?: string[]; author: string; thumbnail?: string; width?: string; downloadUrl?: string; }
const precompiled = precompiledData as { posts: PrecompiledMeta[] };
// posts-content may or may not exist during very first build; guard.
let precompiledContent: Record<string, string> = {};
try {
  precompiledContent = (await import('../data/posts-content.json', { assert: { type: 'json' } as unknown as { type: 'json' } })) as unknown as Record<string, string>;
} catch {
  try {
    // fallback without import assertion (tooling compatibility)
    precompiledContent = (Function('return typeof require!="undefined" ? require("../data/posts-content.json") : {}'))();
  } catch {
    precompiledContent = {};
  }
}

export function getAuthorSlug(author: string): string {
  return author.toLowerCase().replace(/\s+/g, '-');
}

export function getProperAuthorName(slug: string): string {
  return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

const postsDir = path.join(process.cwd ? process.cwd() : '', 'posts');

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
  // If fs unavailable, reconstruct markdown posts from precompiled metadata + content.
  if (!fs || !matter) {
    const posts: Post[] = precompiled.posts
      .filter(p => precompiledContent[p.slug] !== undefined)
      .map(p => ({
        slug: p.slug,
        title: p.title,
        date: p.date,
        timezone: p.timezone,
        excerpt: p.excerpt,
        content: precompiledContent[p.slug] || '',
        tags: p.tags,
        author: p.author,
        thumbnail: p.thumbnail,
        width: (['small','medium','large'].includes(p.width || '') ? p.width : 'medium') as Post['width'],
        ...(p.downloadUrl ? { downloadUrl: p.downloadUrl } : {})
      }));
    markdownCache = posts;
    return posts;
  }
  if (!fs.existsSync(postsDir)) {
    markdownCache = [];
    return markdownCache;
  }
  const fileNames = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
  const posts = fileNames.map((fileName) => {
    const slug = fileName.replace(/\.md$/, '');
    const fullPath = path.join(postsDir, fileName);
    const fileContents = fs!.readFileSync(fullPath, 'utf8');
  const parsed = matter!(fileContents) as unknown as { data: Record<string, unknown>; content: string };
  const data = parsed.data;
  const content = parsed.content;
  const { iso, timezone } = parseDateWithTimezone(String((data as Record<string, unknown>).date));
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
      width: data.width || 'medium',
    } as Post;
  });
  markdownCache = posts;
  return posts;
}

// Recursively search for album JSON files and convert them to Post objects.
let albumCache: Post[] | null = null;
function getAlbumPosts(force = false): Post[] {
  if (!force && albumCache) return albumCache;
  // If no fs, derive album posts from precompiled metadata (those without content).
  if (!fs) {
    albumCache = precompiled.posts
      .filter(p => precompiledContent[p.slug] === undefined)
      .map(p => ({
        slug: p.slug,
        title: p.title,
        date: p.date,
        timezone: p.timezone,
        excerpt: p.excerpt || '',
        content: '',
        tags: p.tags,
        author: p.author,
        thumbnail: p.thumbnail,
        width: (['small','medium','large'].includes(p.width || '') ? p.width : 'large') as Post['width'],
        ...(p.downloadUrl ? { downloadUrl: p.downloadUrl } : {})
      }));
    return albumCache;
  }
  const albumsDir = path.join(process.cwd(), 'albums');
  const results: Post[] = [];
  function walk(dir: string) {
    const items = fs!.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs!.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile() && path.extname(item).toLowerCase() === '.json') {
        const relativePath = path.relative(albumsDir, fullPath).replace(/\\/g, '/');
        const parts = relativePath.split('/');
        if (parts.length === 3) {
          const [year, month, fileName] = parts;
          const slug = fileName.replace(/\.json$/, '');
            const fileContents = fs!.readFileSync(fullPath, 'utf8');
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
              width: data.width || 'large',
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
  // If fs unavailable we can reconstruct all from precompiled directly for performance.
  if (!fs) {
    const combined: Post[] = precompiled.posts.map(p => ({
      slug: p.slug,
      title: p.title,
      date: p.date,
      timezone: p.timezone,
      excerpt: p.excerpt,
      content: precompiledContent[p.slug] || '',
      tags: p.tags,
      author: p.author,
      thumbnail: p.thumbnail,
      width: (['small','medium','large'].includes(p.width || '') ? p.width : 'medium') as Post['width'],
      ...(p.downloadUrl ? { downloadUrl: p.downloadUrl } : {})
    }));
    return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
  const markdownPosts = getPostsFromBin();
  const albumPosts = getAlbumPosts();
  const allPosts = [...markdownPosts, ...albumPosts];
  return allPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Retrieve a post based on the slug from markdown or album posts.
export function getPostBySlug(slug: string): Post | null {
  // Edge fallback: compose from precompiled data.
  if (!fs || !matter) {
    const meta = precompiled.posts.find(p => p.slug === slug);
    if (!meta) return null;
    return {
      ...meta,
      content: precompiledContent[slug] || ''
    } as Post;
  }
  const fullPath = path.join(postsDir, `${slug}.md`);
  if (fs.existsSync(fullPath)) {
    const fileContents = fs.readFileSync(fullPath, 'utf8');
            const parsed = matter!(fileContents) as unknown as { data: Record<string, unknown>; content: string };
            const data = parsed.data as Record<string, unknown>;
            const content = parsed.content;
  const { iso, timezone } = parseDateWithTimezone(String((data as Record<string, unknown>).date));
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
      width: data.width || 'medium',
    } as Post;
  }
  const albumPosts = getAlbumPosts();
  const found = albumPosts.find(post => post.slug === slug);
  return found || null;
}