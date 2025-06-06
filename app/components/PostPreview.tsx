// PostPreview: Renders a preview for a single post with its metadata and image.
import Link from 'next/link';
import Image from 'next/image';
import styles from './PostPreview.module.css';
import React from 'react';
import { tagToSlug } from '../../lib/tagUtils';
import { sanitizePathSegment } from '../../lib/sanitizeUrl';

interface PostPreviewProps {
  title: string;
  author: string;
  date: string;
  timezone: string;
  imageSrc: string;
  thumbnail?: string;
  slug: string;
  altText?: string;
  tags?: string[];
}

export default function PostPreview({ title, author, date, timezone, imageSrc, thumbnail, slug, altText, tags }: PostPreviewProps) {
  const postDate = new Date(date);
  const year = postDate.getFullYear().toString();
  const month = postDate.toLocaleString('en-US', {
    timeZone: timezone,
    month: '2-digit'
  });
  const formattedDate = postDate.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezone
  });
  const imgSrc = thumbnail || imageSrc;

  return (
    <article className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <Link href={`/${sanitizePathSegment(year)}/${sanitizePathSegment(month)}/${sanitizePathSegment(slug)}`} className={styles.link}>
            {title}
          </Link>
        </h2>
        {tags && tags.length > 0 && (
          <div className={styles.tags}>
            {tags.map((tag, index) => (
              <Link 
                key={index} 
                href={`/category/${tagToSlug(tag)}/`} 
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
      <Link href={`/${sanitizePathSegment(year)}/${sanitizePathSegment(month)}/${sanitizePathSegment(slug)}`} className={styles.link}>
        <div className={styles.imageWrapper}>
          <Image
            unoptimized={!!thumbnail}
            src={imgSrc}
            alt={altText || title}
            width={700}
            height={475}
            className={styles.image}
          />
        </div>
      </Link>
    </article>
  );
}