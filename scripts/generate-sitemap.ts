import fs from 'fs';
import path from 'path';
import { SitemapStream, streamToPromise, SitemapIndexStream } from 'sitemap';
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
const crawlBaseUrl = process.env.CRAWL_BASE_URL || '';
const crawlMaxPages = Number(process.env.CRAWL_MAX_PAGES || 1000);

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
  // Buckets for sitemap grouping
  type Entry = { url: string; changefreq?: string; priority?: number; lastmod?: string; img?: Array<{ url: string; title?: string; caption?: string }>; };
  const coreEntries: Entry[] = [];
  const aggregatorEntries: Entry[] = [];
  const postEntries: Entry[] = [];

  // Add static pages with prioritized hierarchy (core highest)
  coreEntries.push({ url: '/', changefreq: 'daily', priority: 1.0 });
  coreEntries.push({ url: '/portfolio', changefreq: 'monthly', priority: 0.9 });
  coreEntries.push({ url: '/about', changefreq: 'monthly', priority: 0.9 });
  coreEntries.push({ url: '/resume', changefreq: 'monthly', priority: 0.9 });
  coreEntries.push({ url: '/privacy-policy', changefreq: 'yearly', priority: 0.2 });

  // Aggregator landing pages (medium priority)
  aggregatorEntries.push({ url: '/archive', changefreq: 'monthly', priority: 0.7 });
  aggregatorEntries.push({ url: '/author', changefreq: 'monthly', priority: 0.6 });
  aggregatorEntries.push({ url: '/category', changefreq: 'weekly', priority: 0.6 });
  aggregatorEntries.push({ url: '/recent', changefreq: 'daily', priority: 0.8 });
  // Do not include /search/ in sitemap (search results pages should not be indexed)

  // Add dynamic posts with balanced priority
  const yearArchives = new Set<string>();
  const monthArchives = new Set<string>();
  // Map of path -> lastmod for posts
  const postLastmod = new Map<string, string>();
  const authorLastmod = new Map<string, string>();
  const categoryLastmod = new Map<string, string>();
  
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
    const postPath = `/${year}/${month}/${post.slug}`;
    postEntries.push({
      url: postPath,
      changefreq: 'weekly',
      priority: 0.8,
      lastmod: new Date(post.date).toISOString(),
      img: post.thumbnail ? [{ url: post.thumbnail.replace(/\/o\//, '/l/').replace(/\.avif$/i, '.jpg'), title: post.title, caption: post.title }] : undefined,
    });
    postLastmod.set(postPath, new Date(post.date).toISOString());

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
    aggregatorEntries.push({
      url: `/${year}`,
      changefreq: 'monthly',
      priority: 0.6,
      lastmod: yearLastmod.get(String(year)),
    });
  });

  // Add month archive pages 
  monthArchives.forEach((monthPath: string) => {
    aggregatorEntries.push({
      url: `/${monthPath}`,
      changefreq: 'weekly',
      priority: 0.6,
      lastmod: monthLastmod.get(monthPath),
    });
  });

  // Dynamic author and category (tag) pages with balanced priority
  const authors = new Set<string>();
  const categories = new Set<string>();
  posts.forEach(post => {
    if (post.author) {
      const a = getAuthorSlug(post.author);
      authors.add(a);
      const iso = new Date(post.date).toISOString();
      if (!authorLastmod.has(a) || iso > (authorLastmod.get(a) as string)) authorLastmod.set(a, iso);
    }
    if (post.tags && Array.isArray(post.tags)) {
      for (const tag of post.tags) {
        const s = tagToSlug(tag);
        categories.add(s);
        const iso = new Date(post.date).toISOString();
        if (!categoryLastmod.has(s) || iso > (categoryLastmod.get(s) as string)) categoryLastmod.set(s, iso);
      }
    }
  });
  authors.forEach(author => {
    aggregatorEntries.push({ url: `/author/${encodeURIComponent(author)}`, changefreq: 'weekly', priority: 0.6, lastmod: authorLastmod.get(author) });
  });
  categories.forEach(category => {
    aggregatorEntries.push({ url: `/category/${encodeURIComponent(category)}`, changefreq: 'weekly', priority: 0.6, lastmod: categoryLastmod.get(category) });
  });

  // Optional: crawl the site to find additional pages and include them
  if (crawlBaseUrl) {
    const extraPaths = await crawlSite(crawlBaseUrl, crawlMaxPages);
    const skipPrefixes = [
      '/_next', '/api', '/cdn-cgi', '/icons', '/static',
    ];
    const skipExact = new Set<string>([
      '/favicon.ico','/robots.txt','/sitemap.xml','/search','/search-index.json','/__nextjs_original-stack-frame','/__nextjs_launch-editor',
    ]);
    for (const p of extraPaths) {
      if (!p || p === '/') continue;
      if (skipExact.has(p)) continue;
      if (skipPrefixes.some(pre => p.startsWith(pre))) continue;
      const normalized = normalizePath(p);
      // Categorize discovered path
      const postMatch = /^\/(\d{4})\/(\d{2})\/[A-Za-z0-9-]+$/.test(normalized);
      const yearMatch = /^\/(\d{4})$/.test(normalized);
      const monthMatch = /^\/(\d{4})\/(\d{2})$/.test(normalized);
      const authorMatch = /^\/author\/[A-Za-z0-9-]+$/.test(normalized);
      const categoryMatch = /^\/category\/[A-Za-z0-9-]+$/.test(normalized);
      const coreSet = new Set<string>(['/','/about','/portfolio','/resume','/privacy-policy']);
      if (coreSet.has(normalized)) continue;
      if (postMatch) {
        if (!postEntries.find(e => e.url === normalized)) postEntries.push({ url: normalized, changefreq: 'weekly', priority: 0.8 });
      } else if (yearMatch || monthMatch || authorMatch || categoryMatch || normalized === '/archive' || normalized === '/author' || normalized === '/category' || normalized === '/recent') {
        if (!aggregatorEntries.find(e => e.url === normalized)) aggregatorEntries.push({ url: normalized, changefreq: 'monthly', priority: 0.6 });
      } else {
        // Unknown page: treat as low-priority aggregator
        if (!aggregatorEntries.find(e => e.url === normalized)) aggregatorEntries.push({ url: normalized, changefreq: 'monthly', priority: 0.4 });
      }
    }
  }

  // Write child sitemaps
  const pubDir = path.join(process.cwd(), 'public');
  const smDir = path.join(pubDir, 'sitemaps');
  if (!fs.existsSync(smDir)) fs.mkdirSync(smDir, { recursive: true });

  async function writeSitemap(fileRel: string, entries: Entry[]) {
    const sm = new SitemapStream({ hostname: baseUrl });
    for (const e of entries) sm.write(e);
    sm.end();
    const data = await streamToPromise(sm);
    fs.writeFileSync(path.join(pubDir, fileRel), data.toString());
    console.log(`Wrote ${fileRel} (${entries.length} urls)`);
  }

  // Chunk posts to multiple files if large
  const MAX_URLS = 45000;
  const childFiles: Array<{ rel: string; abs: string; lastmod?: string }> = [];

  // Core
  await writeSitemap('sitemaps/core.xml', coreEntries);
  childFiles.push({ rel: 'sitemaps/core.xml', abs: new URL('/sitemaps/core.xml', baseUrl).toString() });

  // Collections/Aggregators
  await writeSitemap('sitemaps/collections.xml', aggregatorEntries);
  childFiles.push({ rel: 'sitemaps/collections.xml', abs: new URL('/sitemaps/collections.xml', baseUrl).toString() });

  // Posts split by year, and a content index that points to each year sitemap
  const postsByYear = new Map<string, Entry[]>();
  for (const e of postEntries) {
    const m = e.url.match(/^\/(\d{4})\//);
    if (!m) continue;
    const y = m[1];
    if (!postsByYear.has(y)) postsByYear.set(y, []);
    postsByYear.get(y)!.push(e);
  }
  const yearFiles: Array<{ rel: string; abs: string; lastmod?: string }> = [];
  const years = Array.from(postsByYear.keys()).sort((a,b)=> b.localeCompare(a));
  for (const y of years) {
    const entries = postsByYear.get(y)!;
    const rel = `sitemaps/content-${y}.xml`;
    await writeSitemap(rel, entries);
    const last = entries.reduce<string | undefined>((m, e) => (e.lastmod && (!m || e.lastmod > m)) ? e.lastmod : m, undefined);
    yearFiles.push({ rel, abs: new URL('/' + rel, baseUrl).toString(), lastmod: last });
  }
  // Write content sitemap index at sitemaps/content.xml
  const contentIdxRel = 'sitemaps/content.xml';
  const contentIdxAbs = new URL('/' + contentIdxRel, baseUrl).toString();
  {
    const sidx = new SitemapIndexStream();
    const w = fs.createWriteStream(path.join(pubDir, contentIdxRel));
    sidx.pipe(w);
    for (const f of yearFiles) sidx.write({ url: f.abs, lastmodISO: f.lastmod });
    sidx.end();
    await new Promise<void>(res => w.on('finish', () => res()));
    console.log(`Wrote ${contentIdxRel} (${yearFiles.length} year files)`);
  }
  childFiles.push({ rel: contentIdxRel, abs: contentIdxAbs });

  // Write index at /sitemap.xml
  const idxStream = new SitemapIndexStream();
  const idxPath = path.join(pubDir, 'sitemap.xml');
  const idxWrite = fs.createWriteStream(idxPath);
  idxStream.pipe(idxWrite);
  for (const f of childFiles) idxStream.write({ url: f.abs, lastmodISO: f.lastmod });
  idxStream.end();
  await new Promise<void>(res => idxWrite.on('finish', () => res()));
  console.log(`Sitemap index written to ${idxPath}`);

  // robots.txt
  const robotsTxtContent = `User-agent: *
Disallow:

Sitemap: ${baseUrl}/sitemap.xml`;
  const robotsTxtPath = path.join(pubDir, 'robots.txt');
  fs.writeFileSync(robotsTxtPath, robotsTxtContent);
  console.log(`robots.txt written to ${robotsTxtPath}`);
}

// --- Simple crawler to discover internal links ---
function normalizePath(p: string): string {
  try {
    // Ensure no trailing slash, except for root
    if (!p) return '/';
    const url = new URL(p, crawlBaseUrl || baseUrl);
    const pathname = url.pathname.replace(/\/+$/, '');
    return pathname === '' ? '/' : pathname;
  } catch {
    return p;
  }
}

async function crawlSite(startUrl: string, maxPages: number): Promise<Set<string>> {
  const start = new URL(startUrl);
  const queue: URL[] = [start];
  const visited = new Set<string>();
  const paths = new Set<string>();
  const sameHost = (u: URL) => u.host === start.host && (u.protocol === 'http:' || u.protocol === 'https:');
  const shouldVisit = (u: URL) => {
    if (!sameHost(u)) return false;
    if (visited.has(u.href)) return false;
    // Skip assets and API-like routes
    const p = u.pathname;
    if (p.startsWith('/_next') || p.startsWith('/api') || p.startsWith('/cdn-cgi')) return false;
    if (p.endsWith('.ico') || p.endsWith('.xml') || p.endsWith('.json') || p.endsWith('.svg') || p.endsWith('.png') || p.endsWith('.jpg') || p.endsWith('.avif')) return false;
    return true;
  };

  while (queue.length && visited.size < maxPages) {
    const current = queue.shift()!;
    if (visited.has(current.href)) continue;
    visited.add(current.href);
    try {
      const res = await fetch(current.href, { redirect: 'follow' });
      const finalUrl = new URL(res.url);
      if (!sameHost(finalUrl)) continue;
      // Record final path
      const finalPath = normalizePath(finalUrl.pathname);
      paths.add(finalPath);
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('text/html')) continue;
      const html = await res.text();
      // Extract hrefs and <link> rels; follow only same-host
      const hrefs = new Set<string>();
      for (const m of html.matchAll(/<a\b[^>]*?href\s*=\s*(["'])(.*?)\1/gi)) {
        if (m[2]) hrefs.add(m[2]);
      }
      for (const m of html.matchAll(/<link\b[^>]*?rel\s*=\s*(["'])(?:next|prev|canonical)\1[^>]*?href\s*=\s*(["'])(.*?)\2/gi)) {
        if (m[3]) hrefs.add(m[3]);
      }
      for (const h of hrefs) {
        // Skip non-http(s) schemes
        if (/^(mailto:|tel:|javascript:)/i.test(h)) continue;
        try {
          const next = new URL(h, finalUrl);
          if (shouldVisit(next)) queue.push(next);
        } catch {}
      }
    } catch {}
  }
  return paths;
}

generateSitemap().catch(error => {
  console.error('Error generating sitemap:', error);
  process.exit(1);
});
