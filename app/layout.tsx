// app/layout.tsx
import './globals.css';
import { ReactNode } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';

export const metadata = {
  title: 'Declan Huggins | Photographer | Computer Scientist',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[var(--background)] text-[var(--foreground)] font-mono">
        <Header />
        <main className="max-w-screen-xl mx-auto p-4">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}