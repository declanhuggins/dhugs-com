import React, { JSX } from 'react';
import { notFound } from 'next/navigation';
import { getAllPosts } from '../../../lib/posts';
import Link from 'next/link';
import { sanitizePathSegment } from '../../../lib/sanitizeUrl';
import { tagToSlug } from '../../../lib/tagUtils';
import { toDate } from 'date-fns-tz';

// Generate parameters for year and month archives.
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
