"use client";
import Link from 'next/link';
import Image from 'next/image';
import styles from './PostPreview.module.css';
import React, { useContext, useEffect } from 'react';
import { PriorityImageContext } from './PriorityImageContext';

interface PostPreviewProps {
  title: string;
  author: string; // added author prop
  date: string;
  imageSrc: string;
  thumbnail?: string; // Optional thumbnail for album posts
  slug: string;
  altText?: string;
  tags?: string[];
  priority?: boolean; // new prop for image priority
}

export default function PostPreview({ title, author, date, imageSrc, thumbnail, slug, altText, tags, priority }: PostPreviewProps) {
  const { register, markLoaded } = useContext(PriorityImageContext);

  useEffect(() => {
    if (priority) {
      register();
    }
  }, [priority, register]);

  const postDate = new Date(date);
  const year = postDate.getFullYear().toString();
  const month = ("0" + (postDate.getMonth() + 1)).slice(-2);
  const formattedDate = postDate.toLocaleDateString('en-US', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric',
    timeZone: 'America/New_York'
  });
  // Use album thumbnail if provided, otherwise fallback to imageSrc.
  const imgSrc = thumbnail || imageSrc;

  return (
    <article className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <Link href={`/${year}/${month}/${slug}`} className={styles.link}>
            {title}
          </Link>
        </h2>
        {tags && tags.length > 0 && (
          <div className={styles.tags}>
            {tags.map((tag, index) => (
              <Link 
                key={index} 
                href={`/category/${tag.toLowerCase()}`} 
                className={styles.tag}
              >
                {tag}
              </Link>
            ))}
          </div>
        )}
      </div>
      <div className={styles.meta}>
        <Link href={`/author/${author.toLowerCase().replace(/\s+/g, '-')}`} className={styles.author}>
          <Image 
            src="/icons/user.svg" 
            alt="Author" 
            width={16} 
            height={16} 
            className={`${styles.icon} svg-foreground`} 
          />
          {author}
        </Link>
        <span className={styles.date}>
          <Image 
            src="/icons/calendar.svg" 
            alt="Calendar" 
            width={16} 
            height={16} 
            className={`${styles.icon} svg-foreground`} 
          />
          {formattedDate}
        </span>
      </div>
      {/* Wrap image in a Link */}
      <Link href={`/${year}/${month}/${slug}`} className={styles.link}>
        <div className={styles.imageWrapper}>
          <Image
            unoptimized={!!thumbnail}
            src={imgSrc}
            alt={altText || title}
            width={700}
            height={475}
            className={styles.image}
            priority={priority} // pass priority flag here
            onLoad={priority ? () => markLoaded() : undefined} // replaced onLoadingComplete with onLoad
          />
        </div>
      </Link>
    </article>
  );
}