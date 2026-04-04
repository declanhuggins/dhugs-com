"use client";
// ImageGallery: Custom reading-order masonry with yet-another-react-lightbox.
import React, { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import styles from './ImageGallery.module.css';
import Lightbox from 'yet-another-react-lightbox';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Download from 'yet-another-react-lightbox/plugins/download';
import 'yet-another-react-lightbox/styles.css';
import { cdnResize } from '../../lib/constants';

export interface GalleryImage {
  src: string;
  alt: string;
  width: number;
  height: number;
  downloadUrl?: string;
}

interface ImageGalleryProps {
  images: GalleryImage[];
  galleryID: string;
}

// Dark gray (#1a1a1a) placeholder matching --footer-background
const PLACEHOLDER_BLUR =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOQkpICAACgAE8sk/soAAAAAElFTkSuQmCC';

function useColumnCount(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [columns, setColumns] = useState(3);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.getBoundingClientRect().width;
    setColumns(w < 700 ? 1 : w < 1100 ? 2 : 3);

    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      setColumns(width < 700 ? 1 : width < 1100 ? 2 : 3);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);
  return columns;
}

export default function ImageGallery({ images, galleryID }: ImageGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useColumnCount(containerRef);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Shortest-column-first distribution: each image goes into the column
  // with the least cumulative height. This keeps columns balanced while
  // preserving natural reading order (images flow top-to-bottom visually).
  const { cols, colIndices } = React.useMemo(() => {
    const c: GalleryImage[][] = Array.from({ length: columnCount }, () => []);
    const idx: number[][] = Array.from({ length: columnCount }, () => []);
    const heights = new Array(columnCount).fill(0);
    images.forEach((img, i) => {
      let shortest = 0;
      for (let col = 1; col < columnCount; col++) {
        if (heights[col] < heights[shortest]) shortest = col;
      }
      c[shortest].push(img);
      idx[shortest].push(i);
      heights[shortest] += img.height / img.width;
    });
    return { cols: c, colIndices: idx };
  }, [images, columnCount]);

  // Progressive slides: /m/ loads instantly, /l/ for mid-res, /o/ for full-res.
  // The lightbox picks the best variant based on viewport width.
  const slides = React.useMemo(
    () =>
      images.map((img) => ({
        src: img.src,
        alt: img.alt,
        width: img.width,
        height: img.height,
        srcSet: [
          { src: cdnResize(img.src, 'small'), width: 480, height: Math.round(480 * (img.height / img.width)) },
          { src: cdnResize(img.src, 'medium'), width: 960, height: Math.round(960 * (img.height / img.width)) },
          { src: cdnResize(img.src, 'large'), width: 1920, height: Math.round(1920 * (img.height / img.width)) },
          { src: img.src, width: img.width, height: img.height },
        ],
        ...(img.downloadUrl ? { download: img.downloadUrl } : {}),
      })),
    [images]
  );

  const handleImageClick = useCallback((originalIndex: number) => {
    setCurrentIndex(originalIndex);
    setLightboxOpen(true);
    setToolbarVisible(true);
  }, []);

  // Auto-hide toolbar after 3s of inactivity, show on mouse move / touch
  const resetHideTimer = useCallback(() => {
    setToolbarVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setToolbarVisible(false), 3000);
  }, []);

  useEffect(() => {
    if (!lightboxOpen) return;
    resetHideTimer();
    const onActivity = () => resetHideTimer();
    window.addEventListener('mousemove', onActivity);
    window.addEventListener('touchstart', onActivity);
    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('touchstart', onActivity);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [lightboxOpen, resetHideTimer]);

  // Scroll gallery to the viewed image when lightbox closes
  const handleClose = useCallback(() => {
    setLightboxOpen(false);
    // Buttons are distributed across columns, so query by data attribute instead
    requestAnimationFrame(() => {
      const allButtons = containerRef.current?.querySelectorAll('button');
      if (!allButtons) return;
      // Build a flat map: each button stores its original index via order in columns
      // We tagged buttons with keys, but we can match by iterating colIndices
      let target: HTMLElement | undefined;
      let btnIdx = 0;
      for (let c = 0; c < cols.length; c++) {
        for (let r = 0; r < colIndices[c].length; r++) {
          if (colIndices[c][r] === currentIndex) {
            target = allButtons[btnIdx] as HTMLElement;
          }
          btnIdx++;
        }
      }
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [currentIndex, cols, colIndices]);

  return (
    <>
      <div ref={containerRef} id={galleryID} className={styles.gallery}>
        {cols.map((col, colIdx) => (
          <div key={colIdx} className={styles.column}>
            {col.map((img, rowIdx) => {
              const originalIndex = colIndices[colIdx][rowIdx];
              const mediumSrc = cdnResize(img.src, 'medium');
              return (
                <button
                  key={originalIndex}
                  className={styles.item}
                  onClick={() => handleImageClick(originalIndex)}
                  type="button"
                  aria-label={img.alt || `View image ${originalIndex + 1}`}
                >
                  <Image
                    src={mediumSrc}
                    alt={img.alt}
                    width={img.width}
                    height={img.height}
                    sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
                    placeholder="blur"
                    blurDataURL={PLACEHOLDER_BLUR}
                    className={styles.img}
                    priority={originalIndex < 5}
                    loading={originalIndex < 5 ? undefined : 'lazy'}
                  />
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <Lightbox
        open={lightboxOpen}
        close={handleClose}
        slides={slides}
        index={currentIndex}
        on={{ view: ({ index }) => setCurrentIndex(index) }}
        carousel={{ finite: false, preload: 3, padding: 0 }}
        animation={{
          swipe: 250,
          navigation: 0,
          fade: 250,
          zoom: 250,
          easing: {
            fade: 'ease',
            swipe: 'ease-out',
            navigation: 'ease-in-out',
          },
        }}
        controller={{
          closeOnBackdropClick: true,
          closeOnPullDown: true,
          closeOnPullUp: true,
        }}
        className={toolbarVisible ? styles.lightboxActive : styles.lightboxIdle}
        styles={{
          root: { zIndex: 100001 },
          container: { background: 'rgba(0,0,0,0.9)' },
        }}
        plugins={[Counter, Zoom, Download]}
        zoom={{
          maxZoomPixelRatio: 3,
          wheelZoomDistanceFactor: 133,
          pinchZoomDistanceFactor: 133,
          doubleClickMaxStops: 2,
          doubleClickDelay: 300,
        }}
        counter={{
          separator: ' / ',
          container: {
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              padding: '16px',
              color: '#fff',
              fontSize: '1.1rem',
              fontWeight: 500,
              zIndex: 100002,
              textShadow: '0 1px 4px rgba(0,0,0,0.7)',
            },
          },
        }}
      />
    </>
  );
}
