"use client";
// ImageGallery: Masonry photo gallery with PhotoSwipe lightbox.
import React from 'react';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';
import MasonryPhotoAlbum, { ClickHandler } from 'react-photo-album';
import 'react-photo-album/masonry.css';
import Image from 'next/image';
import styles from './ImageGallery.module.css';

export interface GalleryImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

interface IndexedImage extends GalleryImage {
  index: number;
  href: string;
}

interface ImageGalleryProps {
  images: GalleryImage[];
  galleryID: string;
}

const TRANSPARENT_BLUR =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ/wP+T24/AAAAAElFTkSuQmCC';

export default function ImageGallery({ images, galleryID }: ImageGalleryProps) {
  const imagesWithIndex = React.useMemo<IndexedImage[]>(
    () => images.map((img, index) => ({ ...img, index, href: img.src })),
    [images]
  );

  const lightbox = React.useRef<PhotoSwipeLightbox>();

  React.useEffect(() => {
    const lb = new PhotoSwipeLightbox({
      pswpModule: () => import('photoswipe'),
      dataSource: imagesWithIndex,
    });
    lb.init();
    lightbox.current = lb;
    return () => {
      lb.destroy();
      lightbox.current = undefined;
    };
  }, [imagesWithIndex]);

  const handleClick = React.useCallback<ClickHandler<IndexedImage>>(
    ({ index, event }) => {
      event.preventDefault();
      lightbox.current?.loadAndOpen(index);
    },
    []
  );

  const columnCounts = React.useCallback((containerWidth: number) => {
    if (containerWidth < 700) return 1;
    if (containerWidth < 1100) return 2;
    return 3;
  }, []);

  return (
    <MasonryPhotoAlbum
      id={galleryID}
      layout="masonry"
      photos={imagesWithIndex}
      columns={columnCounts}
      spacing={4}
      padding={0}
      onClick={handleClick}
      className={`${styles.gallery} pswp-gallery`}
      componentsProps={{
        link: {
          className: styles.item,
          target: '_blank',
          rel: 'noreferrer',
        },
        image: ({ index }) => ({
          as: Image,
          placeholder: 'blur',
          blurDataURL: TRANSPARENT_BLUR,
          className: styles.img,
          priority: index < 2,
        }),
      }}
    />
  );
}
