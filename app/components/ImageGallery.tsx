"use client";
import React, { useEffect } from 'react';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';
import Image from 'next/image';
import styles from './ImageGallery.module.css';

export interface GalleryImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

interface ImageGalleryProps {
  images: GalleryImage[];
  galleryID: string;
}

const TRANSPARENT_BLUR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ/wP+T24/AAAAAElFTkSuQmCC";

export default function ImageGallery({ images, galleryID }: ImageGalleryProps) {
  useEffect(() => {
    const lightbox = new PhotoSwipeLightbox({
      gallery: '#' + galleryID,
      children: 'a',
      pswpModule: () => import('photoswipe')
    });
    lightbox.init();
    return () => {
      lightbox.destroy();
    };
  }, [galleryID]);

  return (
    <div>
      <div id={galleryID} className={`${styles.masonry} pswp-gallery`}>
        {images.map((img, index) => (
          <a
            href={img.src}
            data-pswp-width={img.width}
            data-pswp-height={img.height}
            key={`${galleryID}-${index}`}
            target="_blank"
            rel="noreferrer"
          >
            <Image 
              src={img.src}
              alt={img.alt}
              width={img.width}
              height={img.height}
              placeholder="blur"
              blurDataURL={TRANSPARENT_BLUR}
              className={styles.item}
            />
          </a>
        ))}
      </div>
    </div>
  );
}
