// PostGrid: Arranges a collection of PostPreview components in a grid layout.
import React from 'react';
import PostPreview from './PostPreview';
import { Post } from '../../lib/posts';
import styles from './PostGrid.module.css';

interface PostGridProps {
  posts: Post[];
}

export default function PostGrid({ posts }: PostGridProps) {
  return (
    <div className={styles.grid}>
      {posts.map((post) => (
        <PostPreview
          key={post.slug}
          slug={post.slug}
          title={post.title}
          author={post.author}
          date={post.date}
          timezone={post.timezone}
          imageSrc={`/thumbnails/${post.slug}.avif`}
          thumbnail={post.thumbnail}
          tags={post.tags}
        />
      ))}
    </div>
  );
}
