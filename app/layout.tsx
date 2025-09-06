// RootLayout: Main layout that applies global styles and wraps the site in theme and layout providers.
import './globals.css';
import { ReactNode } from 'react';
import type { Metadata } from 'next';
import Header from './components/Header';
import Footer from './components/Footer';
import { ThemeProvider } from 'next-themes';
import Body from './components/Body';

export const metadata: Metadata = {
  metadataBase: (() => {
    try {
      const base = process.env.BASE_URL || 'https://dhugs.com';
      return new URL(base);
    } catch {
      return new URL('https://dhugs.com');
    }
  })(),
  title: {
    default: 'Declan Huggins',
    template: '%s | Declan Huggins',
  },
  description: 'Declan Huggins is a computer scientist and photographer at Notre Dame, blending technology, audio/visual engineering, and ROTC leadership.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Declan Huggins',
    description: 'Computer science student and photographer at Notre Dame, Declan Huggins combines technical expertise in software and audio/visual engineering with service and leadership in Air Force ROTC.',
    siteName: 'Declan Huggins',
    type: 'website',
    locale: 'en_US',
  },
};

// Apply static generation defaults to the entire app subtree.
// This ensures Next pre-renders RSC payloads and HTML at build time,
// so client navigations (with ?_rsc=...) are served from static assets
// instead of invoking the server function.
export const dynamic = 'force-static';
export const revalidate = false;
export const fetchCache = 'only-cache';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="bg-[var(--background)] text-[var(--foreground)] font-mono">
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem={true}>
          <Header />
          <Body>
            {children}
          </Body>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
