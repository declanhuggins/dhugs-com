import React from 'react';
import Link from 'next/link';
import { Post } from '../../lib/posts';
import styles from './Sidebar.module.css';

interface Archive {
  year: string;
  month: string;
}

interface SidebarProps {
  posts: Post[];
  archives: Archive[];
  categories: string[];
}

export default function Sidebar({ posts, archives, categories }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.section}>
        <Link href="/recent">
          <h3 className={styles.header}>Recent Posts</h3>
        </Link>
        <ul className={styles.list}>
          {posts.slice(0, 5).map(post => {
            const postDate = new Date(post.date);
            const year = postDate.getFullYear().toString();
            const month = ("0" + (postDate.getMonth() + 1)).slice(-2);
            return (
              <li key={post.slug} className={styles.listItem}>
                <a href={`/${year}/${month}/${post.slug}`}>{post.title}</a>
              </li>
            );
          })}
        </ul>
      </div>
      <div className={styles.section}>
        <Link href="/archive">
          <h3 className={styles.header}>Archives</h3>
        </Link>
        <ul className={styles.list}>
          {archives.map(archive => (
            <li key={`${archive.year}-${archive.month}`} className={styles.listItem}>
              <a href={`/${archive.year}/${archive.month}`}>
                {new Date(parseInt(archive.year), parseInt(archive.month) - 1)
                  .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.section}>
        <Link href="/category">
          <h3 className={styles.header}>Categories</h3>
        </Link>
        {categories.length === 0 ? (
          <p className={styles.emptyText}>No categories available.</p>
        ) : (
          <ul className={styles.list}>
            {categories.map(tag => (
              <li key={tag} className={styles.listItem}>
                <Link href={`/category/${tag.toLowerCase()}`} className={styles.link}>
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
