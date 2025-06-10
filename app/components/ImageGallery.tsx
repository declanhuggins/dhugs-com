// ImageGallery: Renders a gallery using PhotoSwipe for lightbox features.
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
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ/wP+T24/AAAAAElFTkSuQmCC";

export default function ImageGallery({ images, galleryID }: ImageGalleryProps) {
  // Number of columns based on window width
  const getColumnCount = () => {
    if (typeof window === 'undefined') return 3;
    if (window.innerWidth < 700) return 1;
    if (window.innerWidth < 1100) return 2;
    return 3;
  };

  const [columns, setColumns] = React.useState<Array<GalleryImage[]> | null>(null);

  React.useEffect(() => {
    function handleResize() {
      const colCount = getColumnCount();
      // Distribute images to columns by balancing total height
      const cols: GalleryImage[][] = Array.from({ length: colCount }, () => []);
      const colHeights = Array(colCount).fill(0);
      images.forEach(img => {
        // Find the column with the smallest total height
        const minCol = colHeights.indexOf(Math.min(...colHeights));
        cols[minCol].push(img);
        colHeights[minCol] += img.height / img.width; // Use aspect ratio as proxy for height
      });
      setColumns(cols);
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [images]);

  React.useEffect(() => {
    // Re-initialize PhotoSwipeLightbox on galleryID or columns change
    const lightbox = new PhotoSwipeLightbox({
      gallery: '#' + galleryID,
      children: 'a',
      pswpModule: () => import('photoswipe'),
    });
    // Remap the order by intercepting the 'itemData' filter
    lightbox.addFilter('itemData', (itemData, index) => {
      // Map the index in the lightbox to the original images array
      const img = images[index as number];
      if (img) {
        // Find the anchor with the correct data-pswp-index
        const anchor = document.querySelector(
          `#${galleryID} a[data-pswp-index='${index}']`
        ) as HTMLElement || undefined;
        return {
          ...itemData,
          src: img.src,
          w: img.width,
          h: img.height,
          element: anchor
        };
      }
      return itemData;
    });
    // Fix: ensure clicking a thumbnail opens the correct image in the lightbox
    lightbox.on('beforeOpen', () => {
      // Find all anchors in DOM order
      const anchors = Array.from(document.querySelectorAll(`#${galleryID} a[data-pswp-src]`));
      // Map src to index in the original images array
      const srcToIndex = new Map(images.map((img, i) => [img.src, i]));
      // Patch the click event to open the correct index
      anchors.forEach(anchor => {
        anchor.addEventListener('click', function(e) {
          e.preventDefault();
          const src = anchor.getAttribute('data-pswp-src');
          const idx = srcToIndex.get(src || '');
          if (typeof idx === 'number') {
            lightbox.loadAndOpen(idx);
          }
        });
      });
    });
    lightbox.init();
    return () => {
      lightbox.destroy();
    };
  }, [galleryID, columns, images]);

  if (!columns) return null;

  return (
    <div id={galleryID} className={`${styles.masonry} pswp-gallery`}>
      {columns.map((col, colIdx) => (
        <div className={styles.masonryColumn} key={colIdx}>
          {col.map((img, index) => {
            const url = new URL(img.src);
            const smallSrc = `${url.origin}/medium${url.pathname}`;
            // Find the index in the original images array
            const globalIndex = images.findIndex(i => i.src === img.src && i.width === img.width && i.height === img.height);
            return (
              <a
                className={styles.item}
                href={img.src}
                data-pswp-width={img.width}
                data-pswp-height={img.height}
                data-pswp-src={img.src}
                data-pswp-index={globalIndex}
                key={`${galleryID}-${colIdx}-${index}`}
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
                  priority={colIdx === 0 && index < 2}
                />
              </a>
            );
          })}
        </div>
      ))}
    </div>
  );
}
