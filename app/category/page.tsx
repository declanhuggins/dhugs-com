// CategoryIndex: Lists all unique categories from posts.
import React from 'react';
import Link from 'next/link';
import { getAllPosts } from '../../lib/posts';
import { tagToSlug } from '../../lib/tagUtils';

export default async function CategoryIndex() {
  const posts = await getAllPosts();
  const tagSet = new Set<string>();
  posts.forEach(post => {
    if (post.tags && Array.isArray(post.tags)) {
      post.tags.forEach(tag => tagSet.add(tag));
    }
  });
  const tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b));

  return (
    <div className="max-w-screen-xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Categories</h1>
      {tags.length === 0 ? (
        <p>No categories available.</p>
      ) : (
        <ul className="space-y-2">
          {tags.map(tag => (
            <li key={tag}>
              <Link href={`/category/${tagToSlug(tag)}`} className="text-xl --link-color hover:underline">
                {tag}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
