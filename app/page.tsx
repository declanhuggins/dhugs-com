// app/page.tsx
import PostPreview from './components/PostPreview';

export default function Home() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
      {/* Left Column: Latest Posts */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Latest Posts</h2>

        <PostPreview
          title="Dec 22"
          date="Posted by Declan Huggins on 20 December, 2024"
          imageSrc="/post-dec20.avif"
        />
        <PostPreview
          title="Nov 17"
          date="Posted by Declan Huggins on 17 November, 2024"
          imageSrc="/post-nov17.avif"
        />

        {/* Add more posts as needed */}
      </section>

      {/* Right Column: Sidebar */}
      <aside>
        <div className="mb-8">
          <h3 className="font-bold mb-2">Recent Posts</h3>
          <ul className="space-y-1 text-sm">
            <li>Dec 22</li>
            <li>Nov 17</li>
            <li>Oct 29</li>
            <li>Sep 13</li>
            {/* etc. */}
          </ul>
        </div>

        <div className="mb-8">
          <h3 className="font-bold mb-2">Archives</h3>
          <ul className="space-y-1 text-sm">
            <li>December 2024</li>
            <li>November 2024</li>
            <li>October 2024</li>
            <li>September 2024</li>
            {/* etc. */}
          </ul>
        </div>
      </aside>
    </div>
  );
}