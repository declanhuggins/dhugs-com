// Home: Displays the latest posts (filtered by a specific tag) alongside a sidebar.
import React from 'react';
import type { Metadata } from 'next';
import Sidebar from './components/Sidebar';
import PostGrid from './components/PostGrid';
import { getAllPosts } from '../lib/posts';

// Static prerender at build time; content fetched from D1 then.

export default async function Home() {
  const posts = (await getAllPosts()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const latestTag = 'Photography';
  const filteredPostsRaw = posts.filter(
    post => post.tags && post.tags.includes(latestTag)
  );
  const filteredPosts = filteredPostsRaw.length > 0 ? filteredPostsRaw : posts;

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
        <h2 className="text-2xl font-bold mb-4">Latest in {latestTag}</h2>
        <PostGrid posts={filteredPosts} />
      </section>
      <Sidebar posts={posts} archives={archives} categories={categories} />
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const cdn = (process.env.CDN_SITE && /^https?:\/\//.test(process.env.CDN_SITE)) ? process.env.CDN_SITE! : 'https://cdn.dhugs.com';
  // Use a dedicated site thumbnail hosted on the CDN.
  // Keep using the large tier for OG.
  const ogImage = `${cdn}/l/thumbnail.jpg`;
  const base = process.env.BASE_URL || 'https://dhugs.com';
  const canonical = '/';
  return {
    alternates: { canonical },
    openGraph: {
      title: 'Declan Huggins',
      description: 'Computer science student and photographer at Notre Dame, Declan Huggins combines technical expertise in software and audio/visual engineering with service and leadership in Air Force ROTC.',
      url: new URL(canonical, base).toString(),
      images: [ogImage],
    },
  };
}
