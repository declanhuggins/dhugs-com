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
              <Link href={`/${year}/${month}/${post.slug}`} className="text-xl --link-color hover:underline">
                {post.title}
              </Link>
              {/* Combined metadata line */}
              <div className="text-sm text-[var(--text-muted)]">
                {(() => {
                  const dateString = new Date(post.date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
                  const authorText = post.author ? ` by ${post.author}` : "";
                  // Define a local variable for tags to guarantee an array for mapping.
                  const tags = post.tags ?? [];
                  let tagLinks = null;
                  if (tags.length > 0) {
                    tagLinks = tags.map((tag, index) => (
                      <React.Fragment key={tag}>
                        <Link href={`/category/${tag.toLowerCase()}`} className="underline">
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