import React, { JSX } from 'react';
import { notFound } from 'next/navigation';
import { getAllPosts } from '../../lib/posts';
import Link from 'next/link';

// Generate unique year params based on post dates.
export async function generateStaticParams() {
  const posts = await getAllPosts();
  const yearSet = new Set<string>();
  posts.forEach(post => {
    const postYear = new Date(post.date).getFullYear().toString();
    yearSet.add(postYear);
  });
  return Array.from(yearSet).map(year => ({ year }));
}

interface PageProps {
  params: Promise<{
    year: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function YearArchive({ params }: PageProps): Promise<JSX.Element> {
  const { year } = await params;
  const posts = await getAllPosts();
  const yearPosts = posts.filter(post => new Date(post.date).getFullYear().toString() === year);
  if (yearPosts.length === 0) {
    notFound();
  }

  // Group posts by month.
  const monthMap = new Map<string, { month: string; posts: typeof yearPosts }>();
  yearPosts.forEach(post => {
    const d = new Date(post.date);
    const month = d.toLocaleString('en-US', {
      timeZone: post.timezone,
      month: '2-digit'
    });
    if (!monthMap.has(month)) {
      monthMap.set(month, { month, posts: [] });
    }
    monthMap.get(month)?.posts.push(post);
  });
  const months = Array.from(monthMap.values()).sort((a, b) => parseInt(a.month) - parseInt(b.month));

  return (
    <div className="max-w-screen-xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">
        <Link href="/archive" className="hover:underline">
          Archive
        </Link>{" "}for {year}
      </h1>
      <ul className="space-y-4">
        {months.map(({ month, posts }) => (
          <li key={month} className="flex items-center space-x-2">
            <Link
              href={`/${year}/${month}`}
              className="text-xl --link-color hover:underline"
            >
              {new Date(parseInt(year), parseInt(month) - 1)
                .toLocaleDateString('en-US', { month: 'long' })}
            </Link>
            <span className="text-sm text-[var(--text-muted)]">
              {posts.length} post{posts.length !== 1 ? "s" : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
