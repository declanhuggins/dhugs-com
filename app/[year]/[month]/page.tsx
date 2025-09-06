import React, { JSX } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllPosts } from '../../../lib/posts';
import Link from 'next/link';
import { sanitizePathSegment } from '../../../lib/sanitizeUrl';
import { tagToSlug } from '../../../lib/tagUtils';
import { toDate } from 'date-fns-tz';

// Enforce fully static generation for month archives
export const dynamic = 'force-static';
export const revalidate = false;
export const fetchCache = 'only-cache';

// Generate parameters for year and month archives.
// Pre-generate all year-month combinations at build time
export async function generateStaticParams() {
  const posts = await getAllPosts();
  const paramsSet = new Set<string>();
  const params: { year: string; month: string }[] = [];

  posts.forEach(post => {
    const postDate = toDate(post.date, { timeZone: post.timezone });
    const year = postDate.getFullYear().toString();
    const month = postDate.toLocaleString('en-US', {
      timeZone: post.timezone,
      month: '2-digit'
    });
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
    const postDate = toDate(post.date, { timeZone: post.timezone });
    const postYear = postDate.getFullYear().toString();
    const postMonth = postDate.toLocaleString('en-US', {
      timeZone: post.timezone,
      month: '2-digit'
    });
    return postYear === year && postMonth === month;
  });

  if (posts.length === 0) {
    notFound();
  }

  // Correctly construct date for display by subtracting 1 from month:
  const archiveDate = new Date(parseInt(year), parseInt(month) - 1);

  return (
    <div className="max-w-screen-xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">
        <Link href="/archive" className="hover:underline">
          Archive
        </Link> for {archiveDate.toLocaleDateString('en-US', { month: 'long' })}{" "}
        <Link href={`/${year}`} className="hover:underline">
          {year}
        </Link>
      </h1>
      <ul className="space-y-4">
        {posts.map(post => {
          return (
            <li key={post.slug}>
              <Link href={`/${sanitizePathSegment(year)}/${sanitizePathSegment(month)}/${sanitizePathSegment(post.slug)}`} className="text-xl --link-color hover:underline">
                {post.title}
              </Link>
              {/* Combined metadata line */}
              <div className="text-sm text-[var(--text-muted)]">
                {(() => {
                  const postDate = toDate(post.date, { timeZone: post.timezone });
                  const dateString = postDate.toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    timeZone: post.timezone,
                  });
                  const authorText = post.author ? ` by ${post.author}` : "";
                  // Define a local variable for tags to guarantee an array for mapping.
                  const tags = post.tags ?? [];
                  let tagLinks = null;
                  if (tags.length > 0) {
                    tagLinks = tags.map((tag, index) => (
                      <React.Fragment key={tag}>
                        <Link href={`/category/${tagToSlug(tag)}`} className="underline">
                          {tag}
                        </Link>
                        {index < tags.length - 2 ? ", " : ""}
                        {index === tags.length - 2 ? " and " : ""}
                      </React.Fragment>
                    ));
                  }
                  return (
                    <>
                      Posted on {dateString}{authorText}
                      {tagLinks && <> in {tagLinks}</>}
                    </>
                  );
                })()}
              </div>
              {post.excerpt && <p className="text-sm mt-1">{post.excerpt}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export async function generateMetadata(
  { params }: { params: Promise<{ year: string; month: string }> }
): Promise<Metadata> {
  const { year, month } = await params;
  const base = process.env.BASE_URL || 'https://dhugs.com';
  const cdn = (process.env.CDN_SITE && /^https?:\/\//.test(process.env.CDN_SITE)) ? process.env.CDN_SITE! : 'https://cdn.dhugs.com';
  const { getAllPosts } = await import('../../../lib/posts');
  const posts = await getAllPosts();
  const hit = posts.find(p => {
    const d = new Date(p.date);
    const y = d.getFullYear().toString();
    const m = d.toLocaleString('en-US', { timeZone: p.timezone, month: '2-digit' });
    return y === year && m === month && p.thumbnail;
  });
  const img = (hit?.thumbnail ? hit.thumbnail.replace(/\/o\//, '/l/').replace(/\.avif$/i, '.jpg') : `${cdn}/l/portfolio/thumbnail.jpg`);
  const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'long' });
  const title = `Archive – ${monthName} ${year}`;
  const description = `Posts from ${monthName} ${year} on Declan Huggins.`;
  const canonical = `/${year}/${month}/`;
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
