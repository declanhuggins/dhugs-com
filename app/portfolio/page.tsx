import React from 'react';
import type { Metadata } from 'next';
import ImageGallery, { GalleryImage } from '../components/ImageGallery';
import { getAlbumImages } from '../../lib/album';

export const dynamic = 'force-static';

export default async function PortfolioPage() {
  // Portfolio images are stored under o/portfolio/images
  const albumFolder = 'o/portfolio/images';
  const albumImages = await getAlbumImages(albumFolder);
  const images: GalleryImage[] = albumImages.map(img => ({
    src: img.thumbnailURL,
    alt: img.alt,
    width: img.width,
    height: img.height,
  }));

  return (
    <article className="mx-auto w-full">
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold">Portfolio</h1>
      </div>
      <ImageGallery images={images} galleryID="portfolio-gallery" />
    </article>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const base = process.env.BASE_URL || 'https://dhugs.com';
  const cdn = (process.env.CDN_SITE && /^https?:\/\//.test(process.env.CDN_SITE)) ? process.env.CDN_SITE! : 'https://cdn.dhugs.com';
  const img = `${cdn}/l/portfolio/thumbnail.jpg`;
  const canonical = '/portfolio';
  return {
    title: 'Portfolio',
    description: 'Selected photography and visual work by Declan Huggins.',
    alternates: { canonical },
    openGraph: {
      title: 'Portfolio',
      description: 'Selected photography and visual work by Declan Huggins.',
      url: new URL(canonical, base).toString(),
      images: [img],
    },
  };
}
