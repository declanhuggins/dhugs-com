import PostPreview from './components/PostPreview';
import { getAllPosts } from '../lib/posts';

export default function Home() {
  const posts = getAllPosts().sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Build a unique archive list from posts
  const archivesMap = new Map<string, { year: string; month: string }>();
  posts.forEach(post => {
    const postDate = new Date(post.date);
    const year = postDate.getFullYear().toString();
    const month = ("0" + (postDate.getMonth() + 1)).slice(-2);
    const key = `${year}-${month}`;
    if (!archivesMap.has(key)) {
      archivesMap.set(key, { year, month });
    }
  });
  const archives = Array.from(archivesMap.values()).sort((a, b) => {
    if (a.year === b.year) return b.month.localeCompare(a.month);
    return b.year.localeCompare(a.year);
  });

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
            {archives.map(archive => (
              <li key={`${archive.year}-${archive.month}`}>
                <a href={`/${archive.year}/${archive.month}`}>
                  {new Date(parseInt(archive.year), parseInt(archive.month) - 1)
                    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}