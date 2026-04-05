'use client';

import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <pre className="text-sm sm:text-base leading-relaxed text-(--text-muted) select-none mb-8">{`
  ____   ___   ___
 | ___| / _ \\ / _ \\
 |___ \\| | | | | | |
  ___) | |_| | |_| |
 |____/ \\___/ \\___/
      `.trim()}</pre>

      <div className="space-y-3 mb-8">
        <p className="text-(--text-muted)">
          <span className="text-(--foreground)">$</span> exec ./page
        </p>
        <p className="text-(--link-hover-color)">
          Error: process exited with non-zero status
        </p>
        {error.digest && (
          <p className="text-(--text-muted) text-sm">
            digest: {error.digest}
          </p>
        )}
      </div>

      <nav className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={() => reset()}
          className="border-2 border-(--border-color) px-4 py-2 hover:text-(--link-hover-color) hover:border-(--link-hover-color) transition-colors bg-transparent text-(--foreground) cursor-pointer"
        >
          retry
        </button>
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
