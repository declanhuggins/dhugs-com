// PostPreview: Renders a preview for a single post with its metadata and image.
import Link from 'next/link';
import Image from 'next/image';
import styles from './PostPreview.module.css';
import React from 'react';

interface PostPreviewProps {
  title: string;
  author: string;
  date: string;
  imageSrc: string;
  thumbnail?: string;
  slug: string;
  altText?: string;
  tags?: string[];
}

export default function PostPreview({ title, author, date, imageSrc, thumbnail, slug, altText, tags }: PostPreviewProps) {
  const postDate = new Date(date);
  const year = postDate.getFullYear().toString();
  const month = ("0" + (postDate.getMonth() + 1)).slice(-2);
  const formattedDate = postDate.toLocaleDateString('en-US', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric',
    timeZone: 'America/New_York'
  });
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
      <Link href={`/${year}/${month}/${slug}`} className={styles.link}>
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