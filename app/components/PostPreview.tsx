// PostPreview: Renders a preview for a single post with its metadata and image.
import Link from 'next/link';
import Image from 'next/image';
import styles from './PostPreview.module.css';
import React from 'react';
import { tagToSlug, parseTags } from '../../lib/tagUtils';
import { sanitizePathSegment } from '../../lib/sanitizeUrl';
import Icon from './Icon';

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
  priority?: boolean;
}

export default function PostPreview({ title, author, date, timezone, imageSrc, thumbnail, slug, altText, tags, priority }: PostPreviewProps) {
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
  const displayTags = parseTags(tags);

  return (
    <article className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <Link href={`/${sanitizePathSegment(year)}/${sanitizePathSegment(month)}/${sanitizePathSegment(slug)}`} className={styles.link}>
            {title}
          </Link>
        </h2>
        {displayTags && displayTags.length > 0 && (
          <div className={styles.tags}>
            {displayTags.map((tag, index) => (
              <Link 
                key={index} 
                href={`/category/${tagToSlug(tag)}`} 
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
          <Icon name="user" size={16} className={styles.icon} />
          {author}
        </Link>
        <span className={styles.date}>
          <Icon name="calendar" size={16} className={styles.icon} />
          {formattedDate}
        </span>
      </div>
      <Link href={`/${sanitizePathSegment(year)}/${sanitizePathSegment(month)}/${sanitizePathSegment(slug)}`} className={styles.link}>
        <div className={styles.imageWrapper}>
          <Image
            src={imgSrc}
            alt={altText || title}
            width={700}
            height={475}
            sizes="(min-width: 768px) 50vw, 100vw"
            loading={priority ? undefined : 'lazy'}
            priority={!!priority}
            className={styles.image}
          />
        </div>
      </Link>
    </article>
  );
}
