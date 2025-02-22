import React, { JSX } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { remark } from 'remark';
import html from 'remark-html';
import { getAllPosts, getPostBySlug } from '../../../../lib/posts';
import { getAlbumImages } from '../../../../lib/album';
import ImageGallery, { GalleryImage } from '../../../components/ImageGallery';

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map(post => {
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
    slug: string 
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PostPage({ params }: PageProps): Promise<JSX.Element> {
  // Await params before destructuring:
  const { year, month, slug } = await params;
  
  const post = await getPostBySlug(slug);
  if (!post) {
    notFound();
  }
  const postDate = new Date(post.date);

  // Inline renderTagLinks using Link instead of TagLink.
  const renderTagLinks = (tags: string[]) => {
    return tags.map((tag, index) => (
      <React.Fragment key={tag}>
        <Link href={`/category/${tag.toLowerCase()}`} className="underline">
          {tag}
        </Link>
        {index < tags.length - 2 ? ", " : ""}
        {index === tags.length - 2 ? " and " : ""}
      </React.Fragment>
    ));
  };

  // If the post content is empty, assume it's an album post.
  if (post.content.trim() === "") {
    // Build the album images folder: e.g. "albums/2024/12/dec-20/images"
    const albumFolder = `albums/${year}/${month}/${slug}/images`;
    const albumImages = await getAlbumImages(albumFolder);
    const images: GalleryImage[] = albumImages.map(img => ({
      src: img.thumbnailURL,
      alt: img.alt,
      width: img.width,
      height: img.height,
    }));
    const formattedDateTime = postDate.toLocaleString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
    return (
      <article className="mx-auto">
        <div className="text-center">
          <h1 className="text-4xl font-bold">{post.title}</h1>
          <div className="mt-4 space-y-2 text-sm text-[var(--text-muted)] mb-4">
            <div>
              Posted on {formattedDateTime} by {post.author}
            </div>
            {post.tags && post.tags.length > 0 && (
              <div>
                Posted in {renderTagLinks(post.tags)}
              </div>
            )}
          </div>
        </div>
        <ImageGallery images={images} galleryID="album-gallery"/>
      </article>
    );
  }

  // Otherwise, render the standard markdown post.
  const processedContent = await remark().use(html).process(post.content);
  const contentHtml = processedContent.toString();
  const formattedDateTime = postDate.toLocaleString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  return (
    <article className="mx-auto">
      <div className="text-center">
        <h1 className="text-4xl font-bold">{post.title}</h1>
        <div className="mt-4 space-y-2 text-sm text-[var(--text-muted)]">
          <div>
            Posted on {formattedDateTime} by {post.author}
          </div>
          {post.tags && post.tags.length > 0 && (
            <div>
              Posted in {renderTagLinks(post.tags)}
            </div>
          )}
        </div>
      </div>
      <div className="prose w-full mx-auto max-w-none py-8" dangerouslySetInnerHTML={{ __html: contentHtml }} />
    </article>
  );
}