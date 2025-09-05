import fs from 'fs';
import path from 'path';
import { spawnSync } from 'node:child_process';
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

async function fetchPostsFromD1(): Promise<PostMeta[]> {
  const binding = process.env.D1_BINDING || 'D1_POSTS'; // fixed binding; env var optional
  const remote = ['--remote','-e', (process.env.CF_ENV || 'prod')];
  const SQL = `SELECT p.slug,p.title,p.date_utc as date,p.timezone,p.author,p.thumbnail,p.width,
    GROUP_CONCAT(t.name,'||') AS tags
  FROM posts p
  LEFT JOIN post_tags pt ON pt.post_id=p.id
  LEFT JOIN tags t ON t.id=pt.tag_id
  GROUP BY p.id
  ORDER BY p.date_utc DESC;`;
  const cmd = ['wrangler','d1','execute',binding,'--command', SQL.replace(/\s+/g,' ').trim(),'--json',...remote];
  let res = spawnSync('npx', cmd, { encoding: 'utf8' });
  // no local fallback; always remote
  if (res.status !== 0) throw new Error(res.stderr || 'wrangler failed');
  const parsed = JSON.parse(res.stdout || '[]');
  let rows: any[] = [];
  if (Array.isArray(parsed)) {
    for (const part of parsed) {
      if (Array.isArray(part?.result)) rows = part.result;
    }
  } else if (Array.isArray(parsed?.result)) {
    rows = parsed.result;
  }
  return rows.map(r => ({
    slug: r.slug,
    title: r.title,
    date: r.date,
    timezone: r.timezone,
    author: r.author,
    thumbnail: r.thumbnail || undefined,
    width: r.width || undefined,
    tags: r.tags ? String(r.tags).split('||').filter(Boolean) : undefined
  }));
}

async function generateSitemap() {
  // Pull directly from D1 instead of precompiled JSON
  let posts: PostMeta[] = [];
  try {
    posts = await fetchPostsFromD1();
  } catch (e) {
    console.warn('Could not query D1 for sitemap; generating minimal sitemap.', e);
  }
  const sitemap = new SitemapStream({ hostname: baseUrl });

  // Add static pages with balanced priorities
  sitemap.write({ url: '/', changefreq: 'daily', priority: 1.0 });
  sitemap.write({ url: '/about', changefreq: 'monthly', priority: 0.9 });
  sitemap.write({ url: '/portfolio', changefreq: 'monthly', priority: 0.9 });
  sitemap.write({ url: '/resume', changefreq: 'monthly', priority: 0.8 });
  sitemap.write({ url: '/privacy-policy', changefreq: 'monthly', priority: 0.5 });

  // New: Additional static pages balanced for SEO
  sitemap.write({ url: '/archive', changefreq: 'weekly', priority: 0.7 });
  sitemap.write({ url: '/author', changefreq: 'weekly', priority: 0.6 });
  sitemap.write({ url: '/category', changefreq: 'weekly', priority: 0.6 });
  sitemap.write({ url: '/recent', changefreq: 'weekly', priority: 0.7 });

  // Add dynamic posts with balanced priority
  const yearArchives = new Set();
  const monthArchives = new Set();
  
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
      priority: 0.8 
    });

    // Only add year/month archive pages if we have content
    yearArchives.add(year);
    monthArchives.add(`${year}/${month}`);
  });

  // Add year archive pages
  yearArchives.forEach(year => {
    sitemap.write({ 
      url: `/${year}/`,
      changefreq: 'monthly',
      priority: 0.6 
    });
  });

  // Add month archive pages 
  monthArchives.forEach(monthPath => {
    sitemap.write({ 
      url: `/${monthPath}/`,
      changefreq: 'monthly', 
      priority: 0.6 
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

  // Also store sitemap into D1 site_meta table (key: 'sitemap.xml') for inspection or other uses
  try {
    const binding = process.env.D1_BINDING || 'D1_POSTS';
    const remote = ['--remote','-e', (process.env.CF_ENV || 'prod')];
    const escaped = sitemapData.replace(/'/g, "''");
    const sql = `INSERT INTO site_meta (key, value) VALUES ('sitemap.xml','${escaped}') ON CONFLICT(key) DO UPDATE SET value=excluded.value;`;
    const res = spawnSync('npx', ['wrangler','d1','execute',binding,'--command',sql, ...remote], { encoding: 'utf8' });
    if (res.status !== 0) {
      console.warn('Warning: failed to write sitemap into D1:', res.stderr?.slice(0,200) || '');
    } else {
      console.log('Sitemap also stored in D1 (site_meta).');
    }
  } catch (e) {
    console.warn('Warning: error while storing sitemap in D1:', e);
  }

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
