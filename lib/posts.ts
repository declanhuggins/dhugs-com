import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// Renamed postsBinDir to postsDir
const postsDir = path.join(process.cwd(), 'posts');

export interface Post {
  slug: string;
  title: string;
  date: string;
  excerpt?: string;
  content: string;
  author: string;
  tags?: string[]; // Optional tags field
  thumbnail?: string; // For album posts, set separately. For regular posts, taken from /thumbnails.
}

// Helper: Get posts from posts directory
export function getPostsFromBin(): Post[] {
  const fileNames = fs.readdirSync(postsDir);
  return fileNames.map((fileName) => {
    const slug = fileName.replace(/\.md$/, '');
    const fullPath = path.join(postsDir, fileName);
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
      thumbnail: data.thumbnail || `https://cdn.dhugs.com/thumbnails/${slug}.avif`
    };
  });
}

// Helper: Recursively crawl /albums/ for album.json files and convert them to Post objects.
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
        // Expect structure: /albums/[year]/[month]/[slug].json
        const relativePath = path.relative(albumsDir, fullPath); // e.g. "2024/12/dec-20.json"
        const parts = relativePath.split(path.sep);
        if (parts.length === 3) {
          const [year, month, fileName] = parts;
          const slug = fileName.replace(/\.json$/, ''); // Use only the file base name (e.g. "dec-20")
          const fullSlug = slug; // The album's slug is just the file base name.
          const fileContents = fs.readFileSync(fullPath, 'utf8');
          const data = JSON.parse(fileContents);
          // Look for a thumbnail file named "thumbnail.avif" in the same directory.
          let thumbnail = undefined;
          const thumbPath = path.join(dir, 'thumbnail.avif');
          if (fs.existsSync(thumbPath)) {
            thumbnail = `https://cdn.dhugs.com/albums/${year}/${month}/${slug}/thumbnail.avif`;
          }
          results.push({
            slug: fullSlug,
            title: data.title,
            date: data.date,
            excerpt: data.excerpt || '',
            content: '', // Album posts don't have content
            tags: data.tags,
            author: data.author,
            thumbnail, // Uses the album-specific thumbnail URL if available
          });
        }
      }
    }
  }

  walk(albumsDir);
  return results;
}

export function getAllPosts(): Post[] {
  const binPosts = getPostsFromBin();
  const albumPosts = getAlbumPosts();
  // Combine and sort by date descending
  return [...binPosts, ...albumPosts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getPostBySlug(slug: string): Post | null {
  // Updated to use postsDir instead of postsBinDir
  const fullPath = path.join(postsDir, `${slug}.md`);
  if (fs.existsSync(fullPath)) {
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
      thumbnail: data.thumbnail || `https://cdn.dhugs.com/thumbnails/${slug}.avif`
    };
  }
  // Otherwise, look in albums/ by matching converted slug.
  const albumPosts = getAlbumPosts();
  const found = albumPosts.find(post => post.slug === slug);
  return found || null;
}