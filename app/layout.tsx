import './globals.css';
import { ReactNode } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import { ThemeProvider } from 'next-themes';
import Container from './components/Container';
import PageLoader from './components/PageLoader';

export const metadata = {
  title: 'Declan Huggins | Photographer | Computer Scientist',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Updated inline script to default to dark if no stored theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var storedTheme = localStorage.getItem('theme');
                  var theme = storedTheme || 'dark';
                  document.documentElement.dataset.theme = theme;
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body suppressHydrationWarning className="bg-[var(--background)] text-[var(--foreground)] font-mono">
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
          <Header />
          <PageLoader>
            <Container>{children}</Container>
          </PageLoader>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}