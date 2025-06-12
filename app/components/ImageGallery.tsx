"use client";
// ImageGallery: Masonry photo gallery with PhotoSwipe lightbox.
import React from 'react';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';
import MasonryPhotoAlbum, { ClickHandler, RenderLinkContext } from 'react-photo-album';
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
  element?: HTMLElement;
  mediumSrc: string;
}

interface ImageGalleryProps {
  images: GalleryImage[];
  galleryID: string;
}

const TRANSPARENT_BLUR =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ/wP+T24/AAAAAElFTkSuQmCC';

export default function ImageGallery({ images, galleryID }: ImageGalleryProps) {
  const imagesWithIndex = React.useMemo<IndexedImage[]>(
    () => images.map((img, index) => {
      const url = new URL(img.src);
      return {
        ...img,
        index,
        href: img.src,
        mediumSrc: `${url.origin}/medium${url.pathname}`,
        // Remove largeSrc and set src to the original (true) source
        src: img.src,
      };
    }),
    [images]
  );

  const lightbox = React.useRef<PhotoSwipeLightbox | undefined>(undefined);

  React.useEffect(() => {
    const lb = new PhotoSwipeLightbox({
      pswpModule: () => import('photoswipe'),
      dataSource: imagesWithIndex,
    });
    // Remove the itemData override for largeSrc
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
      // Set the element property to the actual <img> for PhotoSwipe animation
      const img = (event.currentTarget as HTMLElement).querySelector('img');
      if (img) {
        imagesWithIndex[index].element = img as HTMLElement;
      } else {
        imagesWithIndex[index].element = event.currentTarget as HTMLElement;
      }
      lightbox.current?.loadAndOpen(index);
    },
    [imagesWithIndex]
  );

  const columnCounts = React.useCallback((containerWidth: number) => {
    if (containerWidth < 700) return 1;
    if (containerWidth < 1100) return 2;
    return 3;
  }, []);

  return (
    <MasonryPhotoAlbum
      layout="masonry"
      photos={imagesWithIndex}
      columns={columnCounts}
      spacing={4}
      padding={0}
      onClick={handleClick}
      componentsProps={{
        container: { id: galleryID, className: `${styles.gallery} pswp-gallery` },
        link: ({ index, ...props }: RenderLinkContext<IndexedImage>) => ({
          ...props,
          className: styles.item,
          target: '_blank',
          rel: 'noreferrer',
          'data-pswp-index': index,
        }),
        image: ({ index }) => ({
          as: Image,
          src: imagesWithIndex[index].mediumSrc,
          placeholder: 'blur',
          blurDataURL: TRANSPARENT_BLUR,
          className: styles.img,
          priority: index < 2,
        }),
      }}
    />
  );
}
