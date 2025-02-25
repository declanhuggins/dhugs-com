import React from 'react';
import Link from 'next/link';
import { getAllPosts } from '../../lib/posts';

function getAuthorSlug(author: string): string {
  return author.toLowerCase().replace(/\s+/g, '-');
}

function getProperAuthorName(slug: string): string {
  return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export default function AuthorIndex() {
  const posts = getAllPosts();
  const authorSet = new Set<string>();
  posts.forEach(post => {
    authorSet.add(getAuthorSlug(post.author));
  });
  const authors = Array.from(authorSet).sort((a, b) => a.localeCompare(b));

  return (
    <div className="max-w-screen-xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Authors</h1>
      {authors.length === 0 ? (
        <p>No authors available.</p>
      ) : (
        <ul className="space-y-2">
          {authors.map(author => (
            <li key={author}>
              <Link href={`/author/${author}`} className="text-xl --link-color hover:underline">
                {getProperAuthorName(author)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
