import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fromZonedTime } from 'date-fns-tz';
import dotenv from "dotenv";

dotenv.config({ path: '.env.local' });

const postsDir = path.join(process.cwd(), 'posts');
const albumsDir = path.join(process.cwd(), 'albums');
const outputDir = path.join(process.cwd(), 'data');
const outputFile = path.join(outputDir, 'search-data.json');

function parseDateWithTimezone(dateStr) {
  const [datePart, tz] = dateStr.split(' ');
  const utc = fromZonedTime(datePart, tz);
  return { iso: utc.toISOString(), timezone: tz };
}

const cdnSite = process.env.CDN_SITE;

if (!cdnSite) {
  throw new Error("CDN_SITE must be defined in .env.local");
}

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Read posts from the posts directory
function getPostsFromBin() {
  const fileNames = fs.readdirSync(postsDir);
  return fileNames.map((fileName) => {
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
      thumbnail: data.thumbnail || `${cdnSite}/medium/thumbnails/${slug}.avif`,
      width: data.width || 'medium', // Default to 'medium' if not specified
    };
  });
}

// Recursively search for album JSON files and convert them to Post objects
function getAlbumPosts() {
  const results = [];

  function walk(dir) {
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
          const { iso, timezone } = parseDateWithTimezone(data.date);
          const thumbnail = `${cdnSite}/medium/albums/${year}/${month}/${slug}/thumbnail.avif`;
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
          });
        }
      }
    }
  }

  walk(albumsDir);
  return results;
}

// Merge markdown and album posts, sorted by date (newest first)
function getAllPosts() {
  const markdownPosts = getPostsFromBin();
  const albumPosts = getAlbumPosts();
  const allPosts = [...markdownPosts, ...albumPosts];
  return allPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Gather all posts and build search data
const posts = getAllPosts();

// Build a simple inverted search index
function buildSearchIndex(posts) {
  const index = {};
  for (const post of posts) {
    const text = `${post.title} ${post.content}`.toLowerCase();
    const tokens = text.match(/[a-z0-9']+/g) || [];
    const unique = [...new Set(tokens.filter(t => t.length > 2 && !/^\d+$/.test(t)))];
    for (const token of unique) {
      if (!index[token]) index[token] = [];
      index[token].push(post.slug);
    }
  }
  return index;
}

const searchIndex = buildSearchIndex(posts);
const postsMeta = posts.map(({ content, ...rest }) => rest);
const searchData = { posts: postsMeta, index: searchIndex };
fs.writeFileSync(outputFile, JSON.stringify(searchData, null, 2));
console.log(`Pre-compiled search data written to ${outputFile}`);
