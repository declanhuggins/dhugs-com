"use client";
// ImageGallery: Masonry photo gallery with yet-another-react-lightbox.
import React, { useState } from 'react';
import MasonryPhotoAlbum, { ClickHandler, RenderLinkContext } from 'react-photo-album';
import 'react-photo-album/masonry.css';
import Image from 'next/image';
import styles from './ImageGallery.module.css';
import Lightbox from 'yet-another-react-lightbox';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';

export interface GalleryImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

interface IndexedImage extends GalleryImage {
  index: number;
  href: string;
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
        src: img.src,
      };
    }),
    [images]
  );

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const zoomRef = React.useRef<any>(null);

  const handleClick = React.useCallback<ClickHandler<IndexedImage>>(
    ({ index, event }) => {
      event.preventDefault();
      setCurrentIndex(index);
      setLightboxOpen(true);
    },
    []
  );

  const columnCounts = React.useCallback((containerWidth: number) => {
    if (containerWidth < 700) return 1;
    if (containerWidth < 1100) return 2;
    return 3;
  }, []);

  return (
    <>
      <MasonryPhotoAlbum
        layout="masonry"
        photos={imagesWithIndex}
        columns={columnCounts}
        spacing={4}
        padding={0}
        onClick={handleClick}
        componentsProps={{
          container: { id: galleryID, className: `${styles.gallery}` },
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
            width: imagesWithIndex[index].width,
            height: imagesWithIndex[index].height,
            placeholder: 'blur',
            blurDataURL: TRANSPARENT_BLUR,
            className: styles.img,
            priority: index < 5,
            loading: index < 5 ? undefined : 'lazy',
          }),
        }}
      />
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={imagesWithIndex.map(img => ({ src: img.src, alt: img.alt }))}
        index={currentIndex}
        on={{
          view: ({ index }) => setCurrentIndex(index),
        }}
        render={{
          buttonPrev: undefined,
          buttonNext: undefined,
          buttonClose: undefined,
          iconPrev: undefined,
          iconNext: undefined,
          iconClose: undefined,
        }}
        carousel={{ finite: false, preload: 2, padding: 0 }}
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
        styles={{
          root: { zIndex: 100001 },
          container: { background: 'rgba(0,0,0,0.5)' },
        }}
        plugins={[Counter, Zoom]}
        zoom={{
          ref: zoomRef,
          wheelZoomDistanceFactor: 133,
          pinchZoomDistanceFactor: 133,
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
              textShadow: '0 1px 4px rgba(0,0,0,0.7)'
            }
          }
        }}
      />
    </>
  );
}
