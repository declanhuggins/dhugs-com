import fs from 'fs';
import path from 'path';
import { SitemapStream, streamToPromise } from 'sitemap';
import dotenv from 'dotenv';

// Load environment variables if present (works in ESM)
dotenv.config({ path: '.env', quiet: true });

interface PostMeta {
  slug: string;
  title: string;
  date: string; // ISO
  timezone: string;
  excerpt?: string;
  tags?: string[];
  author: string;
  thumbnail?: string;
  width?: string;
}

function getAuthorSlug(author: string): string {
  return author.toLowerCase().replace(/\s+/g, '-');
}

function tagToSlug(tag: string): string {
  return tag.toLowerCase().replace(/ /g, '-');
}

const baseUrl = process.env.BASE_URL || 'https://dhugs.com';

async function loadPostsFromSnapshot(): Promise<PostMeta[]> {
  // Use the precomputed snapshot from dist/data/posts.json
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const file = path.join(process.cwd(), 'dist', 'data', 'posts.json');
  const content = await fs.readFile(file, 'utf8');
  const rows = JSON.parse(content) as Array<{
    slug: string;
    title: string;
    date: string;
    timezone: string;
    author: string;
    thumbnail?: string | null;
    width?: string | null;
    tags?: string[] | null;
  }>;
  return rows.map(r => ({
    slug: r.slug,
    title: r.title,
    date: r.date,
    timezone: r.timezone,
    author: r.author,
    thumbnail: r.thumbnail || undefined,
    width: r.width || undefined,
    tags: r.tags || undefined,
  }));
}

async function generateSitemap() {
  // Use the precomputed posts snapshot (no DB at sitemap time)
  let posts: PostMeta[] = [];
  try {
    posts = await loadPostsFromSnapshot();
  } catch (e) {
    console.warn('Could not load dist/data/posts.json for sitemap; generating minimal sitemap.', e);
  }
  const sitemap = new SitemapStream({ hostname: baseUrl });

  // Add static pages with balanced priorities
  sitemap.write({ url: '/', changefreq: 'daily', priority: 1.0 });
  sitemap.write({ url: '/about/', changefreq: 'monthly', priority: 0.6 });
  sitemap.write({ url: '/portfolio/', changefreq: 'monthly', priority: 0.7 });
  sitemap.write({ url: '/resume/', changefreq: 'monthly', priority: 0.7 });
  sitemap.write({ url: '/privacy-policy/', changefreq: 'yearly', priority: 0.2 });

  // New: Additional static pages balanced for SEO
  sitemap.write({ url: '/archive/', changefreq: 'monthly', priority: 0.5 });
  sitemap.write({ url: '/author/', changefreq: 'monthly', priority: 0.4 });
  sitemap.write({ url: '/category/', changefreq: 'weekly', priority: 0.5 });
  sitemap.write({ url: '/recent/', changefreq: 'daily', priority: 0.9 });
  // Do not include /search/ in sitemap (search results pages should not be indexed)

  // Add dynamic posts with balanced priority
  const yearArchives = new Set<string>();
  const monthArchives = new Set<string>();
  
  const yearLastmod = new Map<string, string>();
  const monthLastmod = new Map<string, string>();
  posts.forEach(post => {
    const postDate = new Date(post.date);
    const year = postDate.getFullYear();
    const month = postDate.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: '2-digit'
    });
    
    // Add full post URL with trailing slash
    sitemap.write({ 
      url: `/${year}/${month}/${post.slug}/`, 
      changefreq: 'weekly', 
      priority: 0.9,
      lastmod: new Date(post.date).toISOString(),
      img: post.thumbnail ? [{ url: post.thumbnail, title: post.title, caption: post.title }] : undefined,
    });

    // Only add year/month archive pages if we have content
    yearArchives.add(String(year));
    monthArchives.add(`${year}/${month}`);
    const iso = new Date(post.date).toISOString();
    const yKey = String(year);
    if (!yearLastmod.has(yKey) || iso > (yearLastmod.get(yKey) as string)) yearLastmod.set(yKey, iso);
    const mKey = `${year}/${month}`;
    if (!monthLastmod.has(mKey) || iso > (monthLastmod.get(mKey) as string)) monthLastmod.set(mKey, iso);
  });

  // Add year archive pages
  yearArchives.forEach((year) => {
    sitemap.write({ 
      url: `/${year}/`,
      changefreq: 'monthly',
      priority: 0.5,
      lastmod: yearLastmod.get(String(year)),
    });
  });

  // Add month archive pages 
  monthArchives.forEach((monthPath: string) => {
    sitemap.write({ 
      url: `/${monthPath}/`,
      changefreq: 'weekly', 
      priority: 0.5,
      lastmod: monthLastmod.get(monthPath),
    });
  });

  // Dynamic author and category (tag) pages with balanced priority
  const authors = new Set<string>();
  const categories = new Set<string>();
  posts.forEach(post => {
    if (post.author) authors.add(getAuthorSlug(post.author));
    if (post.tags && Array.isArray(post.tags)) {
      post.tags.forEach(tag => categories.add(tagToSlug(tag)));
    }
  });
  authors.forEach(author => {
    sitemap.write({ url: `/author/${encodeURIComponent(author)}/`, changefreq: 'weekly', priority: 0.7 });
  });
  categories.forEach(category => {
    sitemap.write({ url: `/category/${encodeURIComponent(category)}/`, changefreq: 'weekly', priority: 0.7 });
  });

  sitemap.end();

  const sitemapPath = path.join(process.cwd(), 'public', 'sitemap.xml');
  const sitemapData = await streamToPromise(sitemap).then(sm => sm.toString());
  fs.writeFileSync(sitemapPath, sitemapData);
  console.log(`Sitemap written to ${sitemapPath}`);

  // No DB write-back; sitemap is fully static and written to public

  // New: generate robots.txt using BASE_URL from .env.local
  const robotsTxtContent = `User-agent: *
Disallow:

Sitemap: ${baseUrl}/sitemap.xml`;
  const robotsTxtPath = path.join(process.cwd(), 'public', 'robots.txt');
  fs.writeFileSync(robotsTxtPath, robotsTxtContent);
  console.log(`robots.txt written to ${robotsTxtPath}`);
}

generateSitemap().catch(error => {
  console.error('Error generating sitemap:', error);
  process.exit(1);
});
