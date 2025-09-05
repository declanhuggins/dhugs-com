// CategoryPage: Displays posts for a given category/tag.
import React, { JSX } from 'react';
import { notFound } from 'next/navigation';
import { getAllPosts } from '../../../lib/posts';
import PostGrid from '../../components/PostGrid';
import { slugToTag, formatTag, tagToSlug } from '../../../lib/tagUtils';

// Pre-generate all categories at build time
export async function generateStaticParams() {
  const posts = await getAllPosts();
  const tagSet = new Set<string>();
  posts.forEach(post => {
    if (post.tags && Array.isArray(post.tags)) {
      post.tags.forEach(tag => tagSet.add(tag.toLowerCase()));
    }
  });
  return Array.from(tagSet).map(tag => ({ tag: tagToSlug(tag) }));
}

interface PageProps {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CategoryPage({ params }: PageProps): Promise<JSX.Element> {
  const { tag } = await params;
  const decodedTag = decodeURIComponent(tag);
  // Convert slug back to normal tag and format for display
  const normalizedTag = slugToTag(decodedTag);
  const displayTag = formatTag(normalizedTag);
  const posts = (await getAllPosts()).filter(
    post => post.tags && post.tags.some(t => t.toLowerCase() === normalizedTag.toLowerCase())
  );

  if (posts.length === 0) {
    notFound();
  }

  return (
    <div className="main-container">
      <h1 className="text-3xl font-bold mb-4">Posts in {displayTag}</h1>
      <PostGrid posts={posts} />
    </div>
  );
}
