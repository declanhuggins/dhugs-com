// PostPage: Renders a blog post and, if the post’s content is empty, displays an album gallery.
import React, { JSX } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { remark } from 'remark';
import html from 'remark-html';
import remarkGfm from 'remark-gfm';
import { getAllPosts, getPostBySlug } from '../../../../lib/posts';
import { getAlbumImages } from '../../../../lib/album';
import ImageGallery, { GalleryImage } from '../../../components/ImageGallery';
import ProseContent from '../../../components/ProseContent';
import { tagToSlug } from '../../../../lib/tagUtils';

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map(post => {
    const postDate = new Date(post.date);
    const year = postDate.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric'
    });
    const month = postDate.toLocaleString('en-US', {
      timeZone: 'America/New_York',
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
  const post = await getPostBySlug(slug);
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
    const albumFolder = `albums/${year}/${month}/${slug}/images`;
    const albumImages = await getAlbumImages(albumFolder);
    const images: GalleryImage[] = albumImages.map(img => ({
      src: img.thumbnailURL,
      alt: img.alt,
      width: img.width,
      height: img.height,
    }));
    const formattedDateTime = postDate.toLocaleString('en-US', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/New_York', timeZoneName: 'short'
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

  const processedContent = await remark().use(remarkGfm).use(html).process(post.content);
  const contentHtml = processedContent.toString();
  const formattedDateTime = postDate.toLocaleString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/New_York', timeZoneName: 'short'
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
