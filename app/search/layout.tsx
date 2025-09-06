import type { Metadata } from 'next';

export default function Layout({ children }: { children: React.ReactNode }) {
  return children as React.ReactElement;
}

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search posts and photo albums on dhugs.com.',
  alternates: { canonical: '/search/' },
  openGraph: {
    title: 'Search',
    description: 'Search posts and photo albums on dhugs.com.',
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};
