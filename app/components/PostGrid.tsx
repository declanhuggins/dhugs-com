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
  const mediumThumb = (post: Post): string => {
    // Build m/YYYY/MM/slug/thumbnail.avif for card thumbnails
    const d = new Date(post.date);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${cdn}/m/${y}/${m}/${post.slug}/thumbnail.avif`;
  };
  const coerceTags = (t: unknown): string[] | undefined => {
    if (Array.isArray(t)) {
      if (t.length === 1) {
        const only = String(t[0] ?? '').trim();
        if (only.startsWith('[')) {
          try { return (JSON.parse(only) as unknown[]).map(x => String(x)); } catch { return [only]; }
        }
      }
      return t.map(x => String(x));
    }
    if (typeof t === 'string') {
      const s = t.trim();
      try {
        if (s.startsWith('[')) return (JSON.parse(s) as unknown[]).map(x => String(x));
      } catch {}
      return s.split(/[,|]+/).map(x => x.trim()).filter(Boolean);
    }
    return undefined;
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
          thumbnail={toMediumThumb(post.thumbnail)}
          tags={coerceTags((post as unknown as { tags?: unknown }).tags)}
          priority={idx < 2}
        />
      ))}
    </div>
  );
}
