// CategoryPage: Displays posts for a given category/tag.
import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllPosts } from '../../../lib/posts';

export async function generateStaticParams() {
  const posts = getAllPosts();
  const tagSet = new Set<string>();
  posts.forEach(post => {
    if (post.tags && Array.isArray(post.tags)) {
      post.tags.forEach(tag => tagSet.add(tag.toLowerCase()));
    }
  });
  return Array.from(tagSet).map(tag => ({ tag }));
}

interface PageProps {
  params: Promise<{ tag: string }>;
}

export default async function CategoryPage({ params }: PageProps) {
  const { tag } = await params;
  const posts = getAllPosts().filter(post => 
    post.tags && post.tags.map(t => t.toLowerCase()).includes(tag)
  );
  
  if (posts.length === 0) {
    notFound();
  }
  
  const displayTag = tag.charAt(0).toUpperCase() + tag.slice(1);
  
  return (
    <div className="max-w-screen-xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">
        <Link href="/category" className="hover:underline">
          Category:
        </Link> {displayTag}
      </h1>
      <ul className="space-y-4">
        {posts.map(post => {
          const postDate = new Date(post.date);
          const year = postDate.getFullYear().toString();
          const month = ("0" + (postDate.getMonth() + 1)).slice(-2);
          return (
            <li key={post.slug}>
              <Link href={`/${year}/${month}/${post.slug}`} className="text-xl --link-color hover:underline">
                {post.title}
              </Link>
              <div className="text-sm text-[var(--text-muted)]">
                Posted on {new Date(post.date).toLocaleDateString('en-US', { 
                  day: 'numeric', month: 'long', year: 'numeric' 
                })}
                {post.author && <> by {post.author}</>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
