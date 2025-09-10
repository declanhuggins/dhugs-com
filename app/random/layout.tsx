import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Random Image',
  description: 'View a randomly selected photo from dhugs.com albums. Refresh for another image.',
  alternates: { canonical: '/random' },
  openGraph: {
    title: 'Random Image',
    description: 'Randomly selected photo from dhugs.com albums.',
    url: 'https://dhugs.com/random',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Random Image',
    description: 'Randomly selected photo from dhugs.com albums.'
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children as React.ReactElement;
}
