// PostPage: Renders a blog post and, if the post’s content is empty, displays an album gallery.
import React, { JSX } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { markdownToSafeHtml } from '../../../../lib/markdown';
import { getAllPosts, getPostByPath } from '../../../../lib/posts';
import { getAlbumImages } from '../../../../lib/album';
import ImageGallery, { GalleryImage } from '../../../components/ImageGallery';
import ProseContent from '../../../components/ProseContent';
import { tagToSlug } from '../../../../lib/tagUtils';

// Force static generation for this route. Any attempt to render at
// request time will error, ensuring we always serve the prebuilt RSC/HTML.
export const dynamic = 'force-static';
export const revalidate = false;
export const fetchCache = 'only-cache';

export async function generateMetadata(
  { params }: { params: Promise<{ year: string; month: string; slug: string }> }
): Promise<Metadata> {
  const { year, month, slug } = await params;
  const post = await getPostByPath(`${year}/${month}/${slug}`);
  if (!post) return { title: 'Not Found' };
  const title = post.title || slug;
  const description = post.excerpt && post.excerpt.trim().length
    ? post.excerpt.trim()
    : `Post by ${post.author}${post.date ? ` on ${new Date(post.date).toLocaleDateString('en-US')}` : ''}.`;
  const thumbnail = post.thumbnail ? post.thumbnail.replace(/\/o\//, '/l/').replace(/\.avif$/i, '.jpg') : undefined;
  const canonical = `/${year}/${month}/${slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      title,
      description,
      url: canonical,
      images: thumbnail ? [thumbnail] : undefined,
    },
  };
}

// Pre-generate all post paths at build time
export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map(post => {
    const postDate = new Date(post.date);
    const year = postDate.toLocaleString('en-US', {
      timeZone: post.timezone,
      year: 'numeric'
    });
    const month = postDate.toLocaleString('en-US', {
      timeZone: post.timezone,
      month: '2-digit'
    });
    return {
      year,
      month,
      slug: post.slug,
    };
  });
}

interface PageProps {
  params: Promise<{ year: string; month: string; slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PostPage({ params }: PageProps): Promise<JSX.Element> {
  const { year, month, slug } = await params;
  const post = await getPostByPath(`${year}/${month}/${slug}`);
  if (!post) {
    notFound();
  }
  const postDate = new Date(post.date);

  const renderTagLinks = (tags: string[]) =>
    tags.map((tag, index) => (
      <React.Fragment key={tag}>
        <Link href={`/category/${tagToSlug(tag)}`} className="underline">
          {tag}
        </Link>
        {index < tags.length - 2 ? ", " : ""}
        {index === tags.length - 2 ? " and " : ""}
      </React.Fragment>
    ));

  if (post.content.trim() === "") {
    const albumFolder = post.path ? `o/${post.path}/images` : `o/${year}/${month}/${slug}/images`;
    const albumImages = await getAlbumImages(albumFolder);
    // Use original-quality URLs for lightbox; thumbnails are derived as /m/ by ImageGallery
    const images: GalleryImage[] = albumImages.map(img => ({
      src: img.largeURL.replace(/\/l\//, '/o/'),
      alt: img.alt,
      width: img.width,
      height: img.height,
      ...(post.downloadUrl ? { downloadUrl: post.downloadUrl } : {})
    }));
    const formattedDateTime = postDate.toLocaleString('en-US', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: post.timezone, timeZoneName: 'short'
    });
    return (
      <article className={`mx-auto ${post.width === 'large' ? 'w-full' : post.width === 'small' ? 'max-w-md' : 'max-w-3xl'}`}>
        <div className="text-center">
          <h1 className="text-4xl font-bold">{post.title}</h1>
          <div className="mt-4 space-y-2 text-sm text-[var(--text-muted)] mb-4">
            <div>Posted on {formattedDateTime} by {post.author}</div>
            {post.tags && post.tags.length > 0 && (
              <div>Posted in {renderTagLinks(post.tags)}</div>
            )}
          </div>
        </div>
        <ImageGallery images={images} galleryID="album-gallery"/>
      </article>
    );
  }

  const contentHtml = await markdownToSafeHtml(post.content);
  const formattedDateTime = postDate.toLocaleString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: post.timezone, timeZoneName: 'short'
  });

  return (
    <article className={`mx-auto ${post.width === 'large' ? 'w-full' : post.width === 'small' ? 'max-w-md' : 'max-w-3xl'}`}>
      <div className="text-center">
        <h1 className="text-4xl font-bold">{post.title}</h1>
        <div className="mt-4 space-y-2 text-sm text-[var(--text-muted)]">
          <div>Posted on {formattedDateTime} by {post.author}</div>
          {post.tags && post.tags.length > 0 && (
            <div>Posted in {renderTagLinks(post.tags)}</div>
          )}
        </div>
      </div>
      <ProseContent
        contentHtml={contentHtml}
        className="w-full mx-auto max-w-none py-8"
      />
    </article>
  );
}
