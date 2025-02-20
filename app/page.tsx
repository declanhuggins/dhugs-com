import React from 'react';
import PostPreview from './components/PostPreview';
import { getAllPosts } from '../lib/posts';
import Link from 'next/link';

export default function Home() {
  const posts = getAllPosts().sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Build a unique archive list from posts
  const archivesMap = new Map<string, { year: string; month: string }>();
  posts.forEach(post => {
    const postDate = new Date(post.date);
    const year = postDate.getFullYear().toString();
    const month = ("0" + (postDate.getMonth() + 1)).slice(-2);
    const key = `${year}-${month}`;
    if (!archivesMap.has(key)) {
      archivesMap.set(key, { year, month });
    }
  });
  const archives = Array.from(archivesMap.values()).sort((a, b) => {
    if (a.year === b.year) return b.month.localeCompare(a.month);
    return b.year.localeCompare(a.year);
  });

  // Build a unique list of categories (tags)
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
        <h2 className="text-2xl font-bold mb-4">Latest Posts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {posts.map(post => (
            <PostPreview
              key={post.slug}
              slug={post.slug}
              title={post.title}
              author={post.author}
              date={post.date}
              imageSrc={`/thumbnails/${post.slug}.avif`}
              tags={post.tags}
            />
          ))}
        </div>
      </section>
      <aside className="mx-auto lg:mx-0 text-center lg:text-left">
        <div className="mb-8">
          <h3 className="font-bold mb-2">Recent Posts</h3>
          <ul className="space-y-1 text-sm">
            {posts.slice(0, 5).map(post => {
              const postDate = new Date(post.date);
              const year = postDate.getFullYear().toString();
              const month = ("0" + (postDate.getMonth() + 1)).slice(-2);
              return (
                <li key={post.slug}>
                  <a href={`/${year}/${month}/${post.slug}`}>{post.title}</a>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="mb-8">
          <Link href="/archive">
            <h3 className="font-bold mb-2 hover:underline">Archives</h3>
          </Link>
          <ul className="space-y-1 text-sm">
            {archives.map(archive => (
              <li key={`${archive.year}-${archive.month}`}>
                <a href={`/${archive.year}/${archive.month}`}>
                  {new Date(parseInt(archive.year), parseInt(archive.month) - 1)
                    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </a>
              </li>
            ))}
          </ul>
        </div>
        {/* New Categories Section */}
        <section className="mt-8">
          <Link href="/category">
            <h3 className="font-bold mb-2 hover:underline">Categories</h3>
          </Link>
          {categories.length === 0 ? (
            <p className="text-sm">No categories available.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {categories.map(tag => (
                <li key={tag}>
                  <Link href={`/category/${tag.toLowerCase()}`} className="hover:underline">
                    {tag}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}