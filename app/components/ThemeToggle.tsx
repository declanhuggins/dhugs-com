// ThemeToggle: Renders a button that toggles between light and dark themes.
'use client';

import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import "./ThemeToggle.module.css";

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const currentTheme = theme === 'system' ? resolvedTheme : theme;
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        disabled
        className="theme-toggle-button rounded-full loading"
        aria-label="Toggle theme loading"
      >
        <div className="theme-toggle-loading-icon rounded-full" />
      </button>
    );
  }

  const toggleTheme = () => setTheme(currentTheme === 'light' ? 'dark' : 'light');

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle-button rounded-full"
      aria-label="Toggle theme"
    >
      <Image
        src={currentTheme === 'light' ? '/icons/moon.svg' : '/icons/sun.svg'}
        alt={currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        width={20}
        height={20}
        className="theme-toggle-icon svg-foreground"
      />
    </button>
  );
}
