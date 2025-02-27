// RootLayout: Main layout that applies global styles and wraps the site in theme and layout providers.
import './globals.css';
import { ReactNode } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import { ThemeProvider } from 'next-themes';
import Body from './components/Body';

export const metadata = {
  title: 'Declan Huggins | Photographer | Computer Scientist',
};

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