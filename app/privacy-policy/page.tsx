import React from 'react';
import fs from 'fs';
import path from 'path';
import { markdownToSafeHtml } from '../../lib/markdown';
import ProseContent from '../components/ProseContent';

export default async function PrivacyPolicyPage() {
    const mdPath = path.join(process.cwd(), 'app', 'privacy-policy', 'privacy-policy.md');
    const fileContents = fs.readFileSync(mdPath, 'utf8');
  const contentHtml = await markdownToSafeHtml(fileContents);
  
    return (
      <div className="mx-auto max-w-3xl px-4">
        <ProseContent
          contentHtml={contentHtml}
          className="w-full mx-auto max-w-none"
        />
      </div>
    );
}
