// app/[year]/[month]/[slug]/page.tsx
import React, { JSX } from 'react';
import { notFound } from 'next/navigation';
import { getAllPosts, getPostBySlug } from '../../../../lib/posts';
import { remark } from 'remark';
import html from 'remark-html';

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

  // Ensure a fixed, deterministic date format
  const formattedDate = new Date(post.date).toLocaleDateString('en-US');

  return (
    <article className="prose mx-auto py-8">
      <h1>{post.title}</h1>
      <div className="text-[var(--text-muted)] mb-4">{formattedDate}</div>
      <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
    </article>
  );
}