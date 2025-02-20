import React, { JSX } from 'react';
import { getAllPosts } from '../../../lib/posts';
import PostPreview from '../../../app/components/PostPreview';
import Link from 'next/link';

function getAuthorSlug(author: string): string {
  return author.toLowerCase().replace(/\s+/g, '-');
}

function getProperAuthorName(slug: string): string {
  return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export const dynamic = 'force-static';

export async function generateStaticParams() {
  const posts = getAllPosts();
  const authors = Array.from(new Set(posts.map(post => getAuthorSlug(post.author))));
  return authors.map(author => ({ author }));
}

interface PageProps {
  params: {
    author: string;
  };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function AuthorPage({ params }: PageProps): JSX.Element {
  const { author: authorSlug } = params;
  const posts = getAllPosts().filter(post => getAuthorSlug(post.author) === authorSlug);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Posts by {getProperAuthorName(authorSlug)}</h1>
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
