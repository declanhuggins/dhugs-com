// AuthorIndex: Lists all unique authors from posts.
import React from 'react';
import Link from 'next/link';
import { getAllPosts, getAuthorSlug, getProperAuthorName } from '../../lib/posts';

export default async function AuthorIndex() {
  const posts = await getAllPosts();
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
