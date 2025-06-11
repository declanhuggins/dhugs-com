'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import PostGrid from '../components/PostGrid';
import type { Post } from '../../lib/posts';

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const query = searchParams ? searchParams.get('q') || '' : '';
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    async function fetchPosts() {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = (await res.json()) as Post[];
      setPosts(data);
    }
    fetchPosts();
  }, [query]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Search Results for &quot;{query}&quot;</h1>
      <PostGrid posts={posts} />
    </div>
  );
}

export default function SearchResults() {
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <SearchResultsContent />
      </Suspense>
    </div>
  );
}
