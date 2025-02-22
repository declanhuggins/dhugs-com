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
      {posts.map(post => (
        <PostPreview
          key={post.slug}
          slug={post.slug}
          title={post.title}
          author={post.author}
          date={post.date}
          imageSrc={`/thumbnails/${post.slug}.avif`}
          tags={post.tags}
        />
      ))}
    </div>
  );
}
