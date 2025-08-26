import './env-init.ts';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
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
const contentOutputFile = path.join(outputDir, 'posts-content.json');
const albumImagesOutputFile = path.join(outputDir, 'album-images.json');

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
  // Track album folder paths for later image enumeration
  discoveredAlbumFolders.length = 0;

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
            discoveredAlbumFolders.push(`albums/${year}/${month}/${slug}/images`);
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

// Collect album folder paths discovered while parsing album posts
const discoveredAlbumFolders: string[] = [];

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

async function main() {
try {
  fs.writeFileSync(outputFile, JSON.stringify(searchData, null, 2));
  console.log(`Pre-compiled search data written to ${outputFile}`);
  // Write separate content mapping for markdown posts so edge runtime can hydrate full content without fs.
  const contentMap: Record<string, string> = {};
  for (const p of posts) {
    if (p.content) contentMap[p.slug] = p.content;
  }
  fs.writeFileSync(contentOutputFile, JSON.stringify(contentMap, null, 2));
  console.log(`Pre-compiled post content written to ${contentOutputFile}`);

  // Attempt to enumerate album images (width/height) using S3 at build time so edge runtime needs no AWS SDK.
  const canUseS3 = !!process.env.AWS_BUCKET_NAME && !!process.env.S3_ENDPOINT && !!process.env.AWS_REGION;
  const albumImageMap: Record<string, { filename: string; width: number; height: number; alt: string; largeURL: string; thumbnailURL: string; }[]> = {};
  // Always attempt to include top-level 'portfolio' gallery if present
  if (!discoveredAlbumFolders.includes('portfolio')) {
    discoveredAlbumFolders.push('portfolio');
  }
  if (canUseS3 && discoveredAlbumFolders.length) {
    try {
      const s3 = new S3Client({
        region: process.env.AWS_REGION || 'auto',
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: true,
        credentials: (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
        } : undefined,
      });
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.avif'];
      const bucketName = process.env.AWS_BUCKET_NAME!;
      const cdn = cdnSite || '';
      // Limit parallelism
      const limit = 5;
      let index = 0;
      async function worker() {
        while (index < discoveredAlbumFolders.length) {
          const myIdx = index++;
            const folder = discoveredAlbumFolders[myIdx];
            try {
              const list = await s3.send(new ListObjectsV2Command({ Bucket: bucketName, Prefix: folder + '/' }));
              const contents = list.Contents || [];
              const images: { filename: string; width: number; height: number; alt: string; largeURL: string; thumbnailURL: string; }[] = [];
              for (const obj of contents) {
                if (!obj.Key) continue;
                const key = obj.Key;
                const ext = key.slice(key.lastIndexOf('.')).toLowerCase();
                if (!allowedExtensions.includes(ext)) continue;
                let width = 1600, height = 900;
                try {
                  const head = await s3.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
                  if (head.Metadata && head.Metadata.width && head.Metadata.height) {
                    width = parseInt(head.Metadata.width, 10) || width;
                    height = parseInt(head.Metadata.height, 10) || height;
                  }
                } catch (err) {
                  // Ignore head failures, fallback defaults
                }
                const filename = key.substring(folder.length + 1);
                const baseUrl = `${cdn}/${folder}/${filename}`.replace(/([^:])\/+/g, '$1/');
                images.push({
                  filename,
                  width,
                  height,
                  alt: filename,
                  largeURL: baseUrl,
                  thumbnailURL: baseUrl,
                });
              }
              albumImageMap[folder] = images;
            } catch (err) {
              console.warn('Failed to list album images for', folder, err);
            }
        }
      }
      await (async () => {
        await Promise.all(Array.from({ length: limit }, () => worker()));
        fs.writeFileSync(albumImagesOutputFile, JSON.stringify(albumImageMap, null, 2));
        console.log(`Pre-compiled album images written to ${albumImagesOutputFile}`);
      })();
    } catch (err) {
      console.warn('Skipping album image precompile due to error:', err);
    }
  } else {
    console.log('Album image precompile skipped (missing S3 env or no albums found).');
  }
} catch (e) {
  console.error('Failed writing search data:', e);
  process.exitCode = 1;
}

if (!cdnSite) {
  console.warn('Warning: CDN_SITE environment variable not set; thumbnails may be blank.');
}
}

// Execute
main();
