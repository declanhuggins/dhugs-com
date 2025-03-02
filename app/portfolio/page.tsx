// PortfolioPage: Displays portfolio images in a gallery.
import React from 'react';
import ImageGallery, { GalleryImage } from '../components/ImageGallery';
import { getAlbumImages } from '../../lib/album';

export default async function PortfolioPage() {
  const albumImages = await getAlbumImages("portfolio");
  const images: GalleryImage[] = albumImages.map(img => ({
    src: img.thumbnailURL,
    alt: img.alt,
    width: img.width,
    height: img.height,
  }));
  return (
    <div>
      <h1 className="text-4xl font-bold mb-8 p-4 text-center">Portfolio</h1>
      <ImageGallery images={images} galleryID="portfolio-gallery"/>
    </div>
  );
}