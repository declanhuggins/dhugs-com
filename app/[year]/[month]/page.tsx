import React, { JSX } from 'react';
import { notFound } from 'next/navigation';
import { getAllPosts } from '../../../lib/posts';
import Link from 'next/link';

export async function generateStaticParams() {
  const posts = await getAllPosts();
  const paramsSet = new Set<string>();
  const params: { year: string; month: string }[] = [];

  posts.forEach(post => {
    const postDate = new Date(post.date);
    const year = postDate.getFullYear().toString();
    const month = ("0" + (postDate.getMonth() + 1)).slice(-2);
    const key = `${year}-${month}`;
    if (!paramsSet.has(key)) {
      paramsSet.add(key);
      params.push({ year, month });
    }
  });

  return params;
}

interface PageProps {
  params: Promise<{
    year: string;
    month: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function MonthArchive({ params }: PageProps): Promise<JSX.Element> {
  const { year, month } = await params;
  
  const posts = (await getAllPosts()).filter(post => {
    const postDate = new Date(post.date);
    const postYear = postDate.getFullYear().toString();
    const postMonth = ("0" + (postDate.getMonth() + 1)).slice(-2);
    return postYear === year && postMonth === month;
  });

  if (posts.length === 0) {
    notFound();
  }

  return (
    <div className="max-w-screen-xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Archive for {month}/{year}</h1>
      <ul className="space-y-4">
        {posts.map(post => (
          <li key={post.slug}>
            <Link href={`/${year}/${month}/${post.slug}`} className="text-xl text-blue-600 hover:underline">
              {post.title}
            </Link>
            <div className="text-sm text-[var(--text-muted)]">
              {new Date(post.date).toLocaleDateString()}
            </div>
            {post.excerpt && <p className="text-sm mt-1">{post.excerpt}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}