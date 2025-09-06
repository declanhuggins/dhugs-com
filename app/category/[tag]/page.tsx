// CategoryPage: Displays posts for a given category/tag.
import React, { JSX } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllPosts } from '../../../lib/posts';
import PostGrid from '../../components/PostGrid';
import { slugToTag, formatTag, tagToSlug } from '../../../lib/tagUtils';

// Enforce fully static generation for categories
export const dynamic = 'force-static';
export const revalidate = false;
export const fetchCache = 'only-cache';

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

export async function generateMetadata(
  { params }: { params: Promise<{ tag: string }> }
): Promise<Metadata> {
  const { tag } = await params;
  const base = process.env.BASE_URL || 'https://dhugs.com';
  const cdn = (process.env.CDN_SITE && /^https?:\/\//.test(process.env.CDN_SITE)) ? process.env.CDN_SITE! : 'https://cdn.dhugs.com';
  const { slugToTag, formatTag } = await import('../../../lib/tagUtils');
  const norm = slugToTag(tag);
  const display = formatTag(norm);
  const { getAllPosts } = await import('../../../lib/posts');
  const posts = await getAllPosts();
  const first = posts.find(p => p.tags?.some(t => t.toLowerCase() === norm.toLowerCase()) && p.thumbnail);
  const img = first?.thumbnail || `${cdn}/o/portfolio/thumbnail.avif`;
  const title = `Posts in ${display}`;
  const description = `Articles and albums tagged “${display}”.`;
  const canonical = `/category/${tag}/`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: new URL(canonical, base).toString(),
      images: [img],
    },
  };
}
