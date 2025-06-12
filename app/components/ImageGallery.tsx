// ImageGallery: Renders a responsive masonry gallery with PhotoSwipe lightbox.
"use client";
import React from 'react';
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
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ/wP+T24/AAAAAElFTkSuQmCC';

export default function ImageGallery({ images, galleryID }: ImageGalleryProps) {
  const [columns, setColumns] = React.useState<GalleryImage[][]>([]);

  const getColumnCount = React.useCallback(() => {
    if (typeof window === 'undefined') return 3;
    if (window.innerWidth < 700) return 1;
    if (window.innerWidth < 1100) return 2;
    return 3;
  }, []);

  React.useEffect(() => {
    function distribute() {
      const colCount = getColumnCount();
      const cols: GalleryImage[][] = Array.from({ length: colCount }, () => []);
      const heights = new Array(colCount).fill(0);
      images.forEach((img) => {
        const ratio = img.height / img.width;
        const col = heights.indexOf(Math.min(...heights));
        cols[col].push(img);
        heights[col] += ratio;
      });
      setColumns(cols);
    }

    distribute();
    window.addEventListener('resize', distribute);
    return () => window.removeEventListener('resize', distribute);
  }, [images, getColumnCount]);

  React.useEffect(() => {
    if (columns.length === 0) return;
    const lightbox = new PhotoSwipeLightbox({
      gallery: '#' + galleryID,
      pswpModule: () => import('photoswipe'),
      dataSource: images,
    });

    const container = document.getElementById(galleryID);
    if (container) {
      const anchors = Array.from(container.querySelectorAll('a'));
      const onClick = (e: Event) => {
        e.preventDefault();
        const target = e.currentTarget as HTMLElement;
        const idx = parseInt(target.getAttribute('data-index') || '0', 10);
        lightbox.loadAndOpen(idx);
      };
      anchors.forEach((a) => a.addEventListener('click', onClick));
      lightbox.init();
      return () => {
        anchors.forEach((a) => a.removeEventListener('click', onClick));
        lightbox.destroy();
      };
    }
  }, [galleryID, images, columns]);

  return (
    <div id={galleryID} className={`${styles.masonry} pswp-gallery`}>
      {columns.map((col, colIdx) => (
        <div className={styles.column} key={colIdx}>
          {col.map((img, index) => {
            const url = new URL(img.src);
            const smallSrc = `${url.origin}/medium${url.pathname}`;
            const globalIndex = images.indexOf(img);
            return (
              <a
                key={`${galleryID}-${colIdx}-${index}`}
                className={styles.item}
                href={img.src}
                data-pswp-width={img.width}
                data-pswp-height={img.height}
                data-index={globalIndex}
                target="_blank"
                rel="noreferrer"
              >
                <Image
                  src={smallSrc}
                  alt={img.alt}
                  width={img.width}
                  height={img.height}
                  placeholder="blur"
                  blurDataURL={TRANSPARENT_BLUR}
                  className={styles.img}
                  priority={globalIndex < 2}
                />
              </a>
            );
          })}
        </div>
      ))}
    </div>
  );
}
