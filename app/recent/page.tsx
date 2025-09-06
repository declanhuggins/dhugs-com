// RecentPage: Renders sorted recent posts with archives and categories.
import React from 'react';
import type { Metadata } from 'next';
import PostGrid from '../components/PostGrid';
import Sidebar from '../components/Sidebar';
import { getAllPosts } from '../../lib/posts';

export default async function RecentPage() {
  const posts = (await getAllPosts()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Construct archives map
  const archivesMap = new Map<string, { year: string; month: string }>();
  posts.forEach(post => {
    const postDate = new Date(post.date);
    const year = postDate.getFullYear().toString();
    const month = postDate.toLocaleString('en-US', {
      timeZone: post.timezone,
      month: '2-digit'
    });
    const key = `${year}-${month}`;
    if (!archivesMap.has(key)) {
      archivesMap.set(key, { year, month });
    }
  });
  const archives = Array.from(archivesMap.values()).sort((a, b) => {
    if (a.year === b.year) return b.month.localeCompare(a.month);
    return b.year.localeCompare(a.year);
  });
  
  // Get unique sorted categories from posts
  const categorySet = new Set<string>();
  posts.forEach(post => {
    if (post.tags && Array.isArray(post.tags)) {
      post.tags.forEach(tag => categorySet.add(tag));
    }
  });
  const categories = Array.from(categorySet).sort((a, b) => a.localeCompare(b));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[8fr_2fr] gap-8">
      <section>
        <h2 className="text-2xl font-bold mb-4">Recent Posts</h2>
        <PostGrid posts={posts} />
      </section>
      <Sidebar posts={posts} archives={archives} categories={categories} />
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const base = process.env.BASE_URL || 'https://dhugs.com';
  const cdn = (process.env.CDN_SITE && /^https?:\/\//.test(process.env.CDN_SITE)) ? process.env.CDN_SITE! : 'https://cdn.dhugs.com';
  const img = `${cdn}/l/portfolio/thumbnail.jpg`;
  const canonical = '/recent';
  return {
    title: 'Recent Posts',
    description: 'The latest writing and photo albums by Declan Huggins.',
    alternates: { canonical },
    openGraph: {
      title: 'Recent Posts',
      description: 'The latest writing and photo albums by Declan Huggins.',
      url: new URL(canonical, base).toString(),
      images: [img],
    },
  };
}
