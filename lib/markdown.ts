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
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/ on[a-z]+="[^"]*"/gi, '');
}
