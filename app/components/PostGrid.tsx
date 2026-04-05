// PostGrid: Arranges a collection of PostPreview components in a grid layout.
import React from 'react';
import PostPreview from './PostPreview';
import { Post } from '../../lib/posts';
import styles from './PostGrid.module.css';
import { parseTags } from '../../lib/tagUtils';
import { CDN_BASE, cdnResize } from '../../lib/constants';

interface PostGridProps {
  posts: Post[];
}

export default function PostGrid({ posts }: PostGridProps) {
  const mediumThumb = (post: Post): string => {
    const d = new Date(post.date);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${CDN_BASE}/m/${y}/${m}/${post.slug}/thumbnail.avif`;
  };
  return (
    <div className={styles.grid}>
      {posts.map((post, idx) => (
        <PostPreview
          key={post.path || `${new Date(post.date).getUTCFullYear()}/${String(new Date(post.date).getUTCMonth()+1).padStart(2,'0')}/${post.slug}`}
          slug={post.slug}
          title={post.title}
          author={post.author}
          date={post.date}
          timezone={post.timezone}
          imageSrc={mediumThumb(post)}
          thumbnail={post.thumbnail ? cdnResize(post.thumbnail, 'medium') : undefined}
          tags={parseTags((post as unknown as { tags?: unknown }).tags)}
          priority={idx < 2}
        />
      ))}
    </div>
  );
}
