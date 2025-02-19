// app/page.tsx
import PostPreview from './components/PostPreview';
import { getAllPosts } from '../lib/posts';

export default function Home() {
  const posts = getAllPosts().sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
      <section>
        <h2 className="text-2xl font-bold mb-4">Latest Posts</h2>
        {posts.map(post => (
          <PostPreview
            key={post.slug}
            slug={post.slug}
            title={post.title}
            date={post.date}
            imageSrc={`/${post.slug}.avif`}
          />
        ))}
      </section>
      <aside>
        <div className="mb-8">
          <h3 className="font-bold mb-2">Recent Posts</h3>
          <ul className="space-y-1 text-sm">
            {posts.slice(0, 5).map(post => {
              const postDate = new Date(post.date);
              const year = postDate.getFullYear().toString();
              const month = ("0" + (postDate.getMonth() + 1)).slice(-2);
              return (
                <li key={post.slug}>
                  <a href={`/${year}/${month}/${post.slug}`}>{post.title}</a>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="mb-8">
          <h3 className="font-bold mb-2">Archives</h3>
          <ul className="space-y-1 text-sm">
            <li>December 2024</li>
            <li>November 2024</li>
            <li>October 2024</li>
            <li>September 2024</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}