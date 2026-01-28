// markdown.ts: Secure markdown-to-HTML pipeline with GFM + sanitization.
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema, type Options as RehypeSanitizeOptions } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';

// Extend the default schema minimally to allow className on code/pre and data-* attributes for lightbox usage.
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), ['className']],
    pre: [...(defaultSchema.attributes?.pre || []), ['className']],
    img: [
      ...(defaultSchema.attributes?.img || []),
      ['data-*'],
      ['loading'],
      ['decoding']
    ],
    a: [
      ...(defaultSchema.attributes?.a || []),
      ['target'],
      ['rel']
    ]
  }
};

export async function markdownToSafeHtml(markdown: string): Promise<string> {
  const file = await remark()
    .use(remarkGfm)
    // remark-html kept for backward compatibility if any raw HTML is present (still sanitized later)
    .use(remarkHtml, { sanitize: false })
    .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeSanitize, schema as RehypeSanitizeOptions)
    .use(rehypeStringify, { allowDangerousHtml: false })
    .process(markdown);
  return String(file);
}

export function stripPotentiallyDangerousTags(html: string): string {
  // Defense in depth (should already be sanitized). Remove any lingering <script> or on* attributes.
  // Apply replacements until reaching a fixed point to avoid incomplete multi-character sanitization.
  let previous: string;
  let current = html;
  do {
    previous = current;
    current = current
      .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\b[^>]*>/gi, '')
      .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  } while (current !== previous);
  return current;
}
