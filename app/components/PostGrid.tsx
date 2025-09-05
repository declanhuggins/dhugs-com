// PostGrid: Arranges a collection of PostPreview components in a grid layout.
import React from 'react';
import PostPreview from './PostPreview';
import { Post } from '../../lib/posts';
import styles from './PostGrid.module.css';

interface PostGridProps {
  posts: Post[];
}

export default function PostGrid({ posts }: PostGridProps) {
  const cdn = (process.env.CDN_SITE && /^https?:\/\//.test(process.env.CDN_SITE)) ? process.env.CDN_SITE : 'https://cdn.dhugs.com';
  const toMediumThumb = (src?: string): string | undefined => {
    if (!src) return src;
    try {
      const u = new URL(src);
      return u.origin + u.pathname.replace(/\/o\//, '/m/');
    } catch {
      return src.replace(/\/o\//, '/m/');
    }
  };
  return (
    <div className={styles.grid}>
      {posts.map((post) => (
        <PostPreview
          key={post.path || `${new Date(post.date).getUTCFullYear()}/${String(new Date(post.date).getUTCMonth()+1).padStart(2,'0')}/${post.slug}`}
          slug={post.slug}
          title={post.title}
          author={post.author}
          date={post.date}
          timezone={post.timezone}
          imageSrc={`${cdn}/m/extras/thumbnails/${post.slug}.avif`}
          thumbnail={toMediumThumb(post.thumbnail)}
          tags={post.tags}
        />
      ))}
    </div>
  );
}
