// app/components/ThemeToggle.tsx
'use client';

import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const currentTheme = theme === 'system' ? resolvedTheme : theme;
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        disabled
        className="p-2 bg-[var(--background)] border border-[var(--border-color)] rounded-full opacity-50 cursor-default"
        aria-label="Toggle theme loading"
      >
        <div className="w-5 h-5 rounded-full bg-gray-300 animate-pulse" />
      </button>
    );
  }

  const toggleTheme = () => setTheme(currentTheme === 'light' ? 'dark' : 'light');

  return (
    <button
      onClick={toggleTheme}
      className="p-2 bg-[var(--background)] border border-[var(--border-color)] rounded-full"
      aria-label="Toggle theme"
    >
      <Image
        src={currentTheme === 'light' ? '/moon.svg' : '/sun.svg'}
        alt={currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        width={20}
        height={20}
        className="svg-foreground"
      />
    </button>
  );
}
