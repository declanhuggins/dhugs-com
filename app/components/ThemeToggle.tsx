// ThemeToggle: Renders a button that toggles between light and dark themes.
'use client';

import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import "./ThemeToggle.module.css";
import Icon from './Icon';

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const currentTheme = theme === 'system' ? resolvedTheme : theme;
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        disabled={true}
        className="theme-toggle-button rounded-full loading"
        aria-label="Toggle theme loading"
        suppressHydrationWarning
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
      <Icon
        name={currentTheme === 'light' ? 'moon' : 'sun'}
        size={20}
        label={currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        className="theme-toggle-icon"
      />
    </button>
  );
}
