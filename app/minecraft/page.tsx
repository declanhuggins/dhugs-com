import React from 'react';
import fs from 'fs';
import path from 'path';
import { remark } from 'remark';
import html from 'remark-html';

export default async function MinecraftPage() {
  const mdPath = path.join(process.cwd(), 'app', 'minecraft', 'minecraft.md');
  const fileContents = fs.readFileSync(mdPath, 'utf8');
  const processedContent = await remark().use(html).process(fileContents);
  const contentHtml = processedContent.toString();

  return (
    <div className="container mx-auto max-w-3xl px-4">
      <article 
        className="prose w-full mx-auto max-w-none" 
        style={{ color: 'var(--foreground)' }}
        dangerouslySetInnerHTML={{ __html: contentHtml }} 
      />
    </div>
  );
}