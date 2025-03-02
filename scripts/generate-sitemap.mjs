import fs from 'fs';
import path from 'path';
import { SitemapStream, streamToPromise } from 'sitemap';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { getAllPosts } = require('../lib/posts.ts');

const baseUrl = process.env.BASE_URL || 'https://dhugs.com';

async function generateSitemap() {
  const posts = await getAllPosts();
  const sitemap = new SitemapStream({ hostname: baseUrl });

  // Add static pages with balanced priorities
  sitemap.write({ url: '/', changefreq: 'daily', priority: 1.0 });
  sitemap.write({ url: '/about', changefreq: 'monthly', priority: 0.9 });
  sitemap.write({ url: '/portfolio', changefreq: 'monthly', priority: 0.9 });
  sitemap.write({ url: '/privacy-policy', changefreq: 'monthly', priority: 0.5 });

  // New: Additional static pages balanced for SEO
  sitemap.write({ url: '/archive', changefreq: 'weekly', priority: 0.7 });
  sitemap.write({ url: '/author', changefreq: 'weekly', priority: 0.6 });
  sitemap.write({ url: '/category', changefreq: 'weekly', priority: 0.6 });
  sitemap.write({ url: '/recent', changefreq: 'weekly', priority: 0.7 });

  // Add dynamic posts with balanced priority
  posts.forEach(post => {
    const postDate = new Date(post.date);
    const year = postDate.getFullYear();
    const month = String(postDate.getMonth() + 1).padStart(2, '0');
    sitemap.write({ url: `/${year}/${month}/${post.slug}`, changefreq: 'weekly', priority: 0.8 });
  });

  // New: Dynamic author and category pages with balanced priority
  const authors = new Set();
  const categories = new Set();
  posts.forEach(post => {
    if (post.author) authors.add(post.author);
    if (post.categories && Array.isArray(post.categories)) {
      post.categories.forEach(cat => categories.add(cat));
    }
  });
  authors.forEach(author => {
    sitemap.write({ url: `/author/${encodeURIComponent(author)}`, changefreq: 'weekly', priority: 0.7 });
  });
  categories.forEach(category => {
    sitemap.write({ url: `/category/${encodeURIComponent(category)}`, changefreq: 'weekly', priority: 0.7 });
  });

  sitemap.end();

  const sitemapPath = path.join(process.cwd(), 'public', 'sitemap.xml');
  const sitemapData = await streamToPromise(sitemap).then(sm => sm.toString());
  fs.writeFileSync(sitemapPath, sitemapData);
  console.log(`Sitemap written to ${sitemapPath}`);
}

generateSitemap().catch(error => {
  console.error('Error generating sitemap:', error);
  process.exit(1);
});
