'use client';

import { useTheme } from 'next-themes';
import React, { FC, useState, useEffect } from 'react';

interface ProseContentProps {
  contentHtml: string;
  className?: string;
}

const ProseContent: FC<ProseContentProps> = ({ contentHtml, className = '' }) => {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const proseClass = !mounted ? 'prose prose-invert' : (theme === 'dark' ? 'prose prose-invert' : 'prose');

  return (
    <div
      className={`${proseClass} ${className}`}
      dangerouslySetInnerHTML={{ __html: contentHtml }}
    />
  );
};

export default ProseContent;
