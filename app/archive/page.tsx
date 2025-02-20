import React from 'react';
import Link from 'next/link';
import { getAllPosts } from '../../lib/posts';

export default function ArchivesTimeline() {
  const posts = getAllPosts();
  const archiveMap: { [year: string]: Set<string> } = {};

  // Group months by year
  posts.forEach(post => {
    const postDate = new Date(post.date);
    const year = postDate.getFullYear().toString();
    const month = ("0" + (postDate.getMonth() + 1)).slice(-2);
    if (!archiveMap[year]) {
      archiveMap[year] = new Set();
    }
    archiveMap[year].add(month);
  });

  // Sort years in ascending order for horizontal timeline
  const years = Object.keys(archiveMap).sort((a, b) => a.localeCompare(b));

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Archives Timeline</h1>
      <div className="overflow-x-auto">
        <div className="flex space-x-8">
          {years.map(year => {
            const months = Array.from(archiveMap[year]).sort((a, b) => a.localeCompare(b));
            return (
              <div key={year} className="min-w-max">
                <h2 className="text-xl font-semibold mb-2">{year}</h2>
                <div className="flex space-x-4">
                  {months.map(month => (
                    <Link
                      key={month}
                      href={`/${year}/${month}`}
                      className="px-4 py-2 bg-[var(--footer-background)] text-[var(--foreground)] rounded hover:bg-[var(--link-hover-color)] whitespace-nowrap"
                    >
                      {new Date(parseInt(year), parseInt(month) - 1)
                        .toLocaleDateString('en-US', { month: 'long' })}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
