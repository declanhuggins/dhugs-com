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

  // Add static pages
  sitemap.write({ url: '/', changefreq: 'daily', priority: 1.0 });
  sitemap.write({ url: '/about', changefreq: 'monthly', priority: 0.8 });
  sitemap.write({ url: '/portfolio', changefreq: 'monthly', priority: 0.8 });
  sitemap.write({ url: '/resume', changefreq: 'monthly', priority: 0.8 });

  // Add dynamic posts
  posts.forEach(post => {
    const postDate = new Date(post.date);
    const year = postDate.getFullYear();
    const month = String(postDate.getMonth() + 1).padStart(2, '0');
    sitemap.write({ url: `/${year}/${month}/${post.slug}`, changefreq: 'weekly', priority: 0.9 });
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
