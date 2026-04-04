import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '404 — Not Found',
  description: 'The page you are looking for does not exist.',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <pre className="text-sm sm:text-base leading-relaxed text-(--text-muted) select-none mb-8">{`
  _  _    ___  _  _
 | || |  / _ \\| || |
 | || |_| | | | || |_
 |__   _| | | |__   _|
    | | | |_| |  | |
    |_|  \\___/   |_|
      `.trim()}</pre>

      <div className="space-y-3 mb-8">
        <p className="text-(--text-muted)">
          <span className="text-(--foreground)">$</span> cat ./page
        </p>
        <p className="text-(--link-hover-color)">
          cat: ./page: No such file or directory
        </p>
      </div>

      <nav className="flex flex-wrap gap-3 justify-center">
        <Link href="/" className="border-2 border-(--border-color) px-4 py-2 hover:text-(--link-hover-color) hover:border-(--link-hover-color) transition-colors">
          ~/ Home
        </Link>
        <Link href="/search" className="border-2 border-(--border-color) px-4 py-2 hover:text-(--link-hover-color) hover:border-(--link-hover-color) transition-colors">
          /search
        </Link>
        <Link href="/archive" className="border-2 border-(--border-color) px-4 py-2 hover:text-(--link-hover-color) hover:border-(--link-hover-color) transition-colors">
          /archive
        </Link>
      </nav>
    </div>
  );
}
