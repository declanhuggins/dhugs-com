// AuthorPage: Displays posts for a specific author.
import React, { JSX } from 'react';
import { getAllPosts } from '../../../lib/posts';
import PostPreview from '../../../app/components/PostPreview';
import Link from 'next/link';
import { getAuthorSlug, getProperAuthorName } from '../../../lib/posts';

export const dynamic = 'force-static';

export async function generateStaticParams() {
  const posts = getAllPosts();
  const authors = Array.from(new Set(posts.map(post => getAuthorSlug(post.author))));
  return authors.map(author => ({ author }));
}

interface PageProps {
  params: Promise<{ author: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AuthorPage({ params }: PageProps): Promise<JSX.Element> {
  const { author: authorSlug } = await params;
  const posts = getAllPosts().filter(post => getAuthorSlug(post.author) === authorSlug);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">
        <Link href="/author" className="--link-color hover:underline">Author:</Link> {getProperAuthorName(authorSlug)}
      </h1>
      {posts.length === 0 ? (
        <p>No posts found for this author.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {posts.map(post => (
            <PostPreview
              key={post.slug}
              slug={post.slug}
              title={post.title}
              author={post.author}
              date={post.date}
              imageSrc={`/thumbnails/${post.slug}.avif`}
              thumbnail={post.thumbnail}
              tags={post.tags}
            />
          ))}
        </div>
      )}
      <p className="mt-6">
        <Link href="/" className="--link-color hover:underline">
          ← Back to Home
        </Link>
      </p>
    </div>
  );
}
