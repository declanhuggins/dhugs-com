// Home: Displays the latest posts (filtered by a specific tag) alongside a sidebar.
import React from 'react';
import Sidebar from './components/Sidebar';
import PostGrid from './components/PostGrid';
import { getAllPosts } from '../lib/posts';

export default function Home() {
  const posts = getAllPosts().sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const latestTag = 'Photography';
  const filteredPosts = posts.filter(
    post => post.tags && post.tags.includes(latestTag)
  );

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