'use client';

import { useTheme } from 'next-themes';
import React, { FC, useState, useEffect } from 'react';

interface ProseContentProps {
  contentHtml: string;
  className?: string;
}

const ProseContent: FC<ProseContentProps> = ({ contentHtml, className = '' }) => {
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Default to dark mode when not mounted; handle 'system' theme if needed.
  const currentTheme = !mounted ? 'dark' : (theme === 'system' ? systemTheme : theme);
  const proseClass = currentTheme === 'dark' ? 'prose prose-invert' : 'prose';

  return (
    <div
      className={`${proseClass} ${className}`}
      dangerouslySetInnerHTML={{ __html: contentHtml }}
    />
  );
};

export default ProseContent;
