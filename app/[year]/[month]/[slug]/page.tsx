import React, { JSX } from 'react';
import { notFound } from 'next/navigation';
import { getAllPosts, getPostBySlug } from '../../../../lib/posts';
import { remark } from 'remark';
import html from 'remark-html';
import TagLink from '../../../components/TagLink';  // Adjust the import path as needed

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => {
    const postDate = new Date(post.date);
    return {
      year: postDate.getFullYear().toString(),
      month: ("0" + (postDate.getMonth() + 1)).slice(-2),
      slug: post.slug,
    };
  });
}

interface PageProps {
  params: Promise<{
    year: string;
    month: string;
    slug: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PostPage({
  params,
}: PageProps): Promise<JSX.Element> {
  const { year, month, slug } = await params;
  
  const post = await getPostBySlug(slug);
  if (!post) {
    notFound();
  }

  const postDate = new Date(post.date);
  const postYear = postDate.getFullYear().toString();
  const postMonth = ("0" + (postDate.getMonth() + 1)).slice(-2);
  if (year !== postYear || month !== postMonth) {
    notFound();
  }

  const processedContent = await remark().use(html).process(post.content);
  const contentHtml = processedContent.toString();

  // Format the date including time and local timezone.
  const formattedDateTime = postDate.toLocaleString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  // Helper function to render tags as linked items with proper punctuation.
  const renderTagLinks = (tags: string[]) => {
    return tags.map((tag, index) => (
      <React.Fragment key={tag}>
        <TagLink tag={tag} className="underline" />
        {index < tags.length - 2 ? ", " : ""}
        {index === tags.length - 2 ? " and " : ""}
      </React.Fragment>
    ));
  };

  return (
    <article className="mx-auto py-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold">{post.title}</h1>
        {/* Wrap metadata lines in a container for consistent spacing */}
        <div className="mt-4 space-y-2 text-sm text-[var(--text-muted)]">
          <div>
            Posted on {formattedDateTime} by {post.author}
          </div>
          {post.tags && post.tags.length > 0 && (
            <div>
              Posted in { renderTagLinks(post.tags) }
            </div>
          )}
        </div>
      </div>
      <div className="prose w-full mx-auto max-w-none py-8" dangerouslySetInnerHTML={{ __html: contentHtml }} />
    </article>
  );
}