import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { toDate } from 'date-fns-tz';
import dotenv from "dotenv";

dotenv.config({ path: '.env.local' });

const postsDir = path.join(process.cwd(), 'posts');
const albumsDir = path.join(process.cwd(), 'albums');
const outputDir = path.join(process.cwd(), 'data');
const outputFile = path.join(outputDir, 'posts.json');

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
    const date = toDate(data.date, { timeZone: 'America/New_York' }).toISOString();
    return {
      slug,
      title: data.title,
      date,
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
          const date = toDate(data.date, { timeZone: 'America/New_York' }).toISOString();
          const thumbnail = `${cdnSite}/medium/albums/${year}/${month}/${slug}/thumbnail.avif`;
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

// Merge markdown and album posts, sorted by date (newest first)
function getAllPosts() {
  const markdownPosts = getPostsFromBin();
  const albumPosts = getAlbumPosts();
  const allPosts = [...markdownPosts, ...albumPosts];
  return allPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Write the pre-compiled data to a JSON file
const posts = getAllPosts();
fs.writeFileSync(outputFile, JSON.stringify(posts, null, 2));
console.log(`Pre-compiled posts data written to ${outputFile}`);
