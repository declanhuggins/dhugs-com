import React from 'react';
import Link from 'next/link';

interface TagLinkProps {
  tag: string;
  className?: string;
}

export default function TagLink({ tag, className }: TagLinkProps) {
  return (
    <Link href={`/category/${tag.toLowerCase()}`} className={className}>
      {tag}
    </Link>
  );
}
