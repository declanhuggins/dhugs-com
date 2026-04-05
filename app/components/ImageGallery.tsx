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

/** Distribute images into columns using shortest-column-first. */
function distributeToColumns(images: GalleryImage[], columnCount: number) {
  const cols: GalleryImage[][] = Array.from({ length: columnCount }, () => []);
  const colIndices: number[][] = Array.from({ length: columnCount }, () => []);
  const heights = new Array(columnCount).fill(0);
  images.forEach((img, i) => {
    let shortest = 0;
    for (let col = 1; col < columnCount; col++) {
      if (heights[col] < heights[shortest]) shortest = col;
    }
    cols[shortest].push(img);
    colIndices[shortest].push(i);
    heights[shortest] += img.height / img.width;
  });
  return { cols, colIndices };
}

/** Check if all images share the same aspect ratio (placeholder dimensions). */
function hasUniformAspectRatios(images: GalleryImage[]): boolean {
  if (images.length < 2) return false;
  const r = images[0].height / images[0].width;
  return images.every((img) => Math.abs(img.height / img.width - r) < 0.001);
}

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
  const zoomRef = useRef<any>(null);

  // When DB dimensions are all identical (placeholder data), we correct them
  // client-side by reading naturalWidth/naturalHeight from loaded images.
  const needsCorrection = hasUniformAspectRatios(images);
  const [correctedImages, setCorrectedImages] = useState<GalleryImage[] | null>(null);
  const loadedDims = useRef<Map<number, { w: number; h: number }>>(new Map());

  const handleImageLoad = useCallback(
    (index: number, e: React.SyntheticEvent<HTMLImageElement>) => {
      if (!needsCorrection) return;
      const img = e.currentTarget;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w && h) {
        loadedDims.current.set(index, { w, h });
        // Once we have enough real dimensions (first batch of visible images),
        // re-compute the layout. Trigger after first 6 images or all loaded.
        const threshold = Math.min(images.length, columnCount * 2);
        if (loadedDims.current.size >= threshold) {
          const fixed = images.map((img, i) => {
            const real = loadedDims.current.get(i);
            return real ? { ...img, width: real.w, height: real.h } : img;
          });
          setCorrectedImages(fixed);
        }
      }
    },
    [needsCorrection, images, columnCount]
  );

  const effectiveImages = correctedImages ?? images;

  const { cols, colIndices } = React.useMemo(
    () => distributeToColumns(effectiveImages, columnCount),
    [effectiveImages, columnCount]
  );

  // Lightbox slides: use /o/ originals, no width/height so the lightbox
  // scales images to fill the viewport rather than capping at pixel dims.
  const slides = React.useMemo(
    () =>
      images.map((img) => ({
        src: img.src,
        alt: img.alt,
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

  // Single-click zoom: zoom in to mouse position, click again to zoom out.
  // Uses capture phase to intercept before the library's own handlers.
  useEffect(() => {
    if (!lightboxOpen) return;

    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.matches('.yarl__slide img')) return;

      const zoom = zoomRef.current;
      if (!zoom || zoom.disabled) return;

      e.stopPropagation();
      e.preventDefault();

      if (zoom.zoom > 1.01) {
        // Currently zoomed — zoom back to fit
        zoom.changeZoom(1);
      } else {
        // Zoom in towards mouse position
        const rect = target.getBoundingClientRect();
        const dx = e.clientX - (rect.left + rect.width / 2);
        const dy = e.clientY - (rect.top + rect.height / 2);
        zoom.changeZoom(2, false, dx, dy);
      }
    };

    // Dampen two-finger trackpad panning when zoomed in.
    // The library passes raw wheel deltas to changeOffsets without dividing
    // by zoom, so visual pan speed scales with zoom level. We intercept the
    // wheel event, cancel it, and re-dispatch a dampened copy.
    const wheelHandler = (e: WheelEvent) => {
      const z = zoomRef.current;
      if (!z || z.zoom <= 1) return;
      // Only intercept non-ctrl (pan) wheel events inside the lightbox
      if (e.ctrlKey) return;
      const target = e.target as HTMLElement;
      if (!target.closest('.yarl__root')) return;

      e.stopPropagation();
      e.preventDefault();

      const dampen = 1 / z.zoom;
      const dampened = new WheelEvent('wheel', {
        ...e,
        deltaX: e.deltaX * dampen,
        deltaY: e.deltaY * dampen,
        bubbles: true,
        cancelable: true,
      });
      // Re-dispatch without our capture listener catching it again
      document.removeEventListener('wheel', wheelHandler, true);
      target.dispatchEvent(dampened);
      document.addEventListener('wheel', wheelHandler, { capture: true, passive: false });
    };

    document.addEventListener('click', handler, true);
    document.addEventListener('wheel', wheelHandler, { capture: true, passive: false });
    return () => {
      document.removeEventListener('click', handler, true);
      document.removeEventListener('wheel', wheelHandler, true);
    };
  }, [lightboxOpen]);

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
    requestAnimationFrame(() => {
      const allButtons = containerRef.current?.querySelectorAll('button');
      if (!allButtons) return;
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
                    onLoad={(e) => handleImageLoad(originalIndex, e)}
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
        on={{
          view: ({ index }) => setCurrentIndex(index),
        }}
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
          container: { background: 'rgba(0,0,0,1)' },
        }}
        plugins={[Counter, Zoom, Download]}
        zoom={{
          ref: zoomRef,
          maxZoomPixelRatio: 2,
          wheelZoomDistanceFactor: 100,
          pinchZoomDistanceFactor: 100,
          doubleClickMaxStops: 0,
          scrollToZoom: false,
          pinchZoomV4: true,
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
