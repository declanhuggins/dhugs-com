import './globals.css';
import { ReactNode } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import { ThemeProvider } from 'next-themes';
import Container from './components/Container';

export const metadata = {
  title: 'Declan Huggins | Photographer | Computer Scientist',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="bg-[var(--background)] text-[var(--foreground)] font-mono">
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={true}>
          <Header />
          {/* Use the Container component to conditionally apply container classes */}
          <Container>{children}</Container>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}