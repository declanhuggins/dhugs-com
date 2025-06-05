'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import PostGrid from '../components/PostGrid';

interface Post {
  id: string;
  title: string;
  content: string;
  slug: string;
  date: string;
  timezone: string;
  author: string;
}

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const query = searchParams ? searchParams.get('q') || '' : '';
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    async function fetchPosts() {
      const res = await fetch('/api/posts');
      const data = await res.json();

      const filteredPosts: Post[] = data.filter((post: Post) =>
        post.title.toLowerCase().includes(query.toLowerCase()) ||
        post.content.toLowerCase().includes(query.toLowerCase())
      );
      setPosts(filteredPosts);
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
