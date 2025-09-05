import React from 'react';
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

