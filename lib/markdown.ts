// markdown.ts: Secure markdown-to-HTML pipeline with GFM + sanitization.
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
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
    .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeSanitize, schema as RehypeSanitizeOptions)
    .use(rehypeStringify, { allowDangerousHtml: false })
    .process(markdown);
  return String(file);
}

export function stripPotentiallyDangerousTags(html: string): string {
  // Defense in depth (should already be sanitized by rehype-sanitize).
  // Encode `<` before script tags rather than removing — a single-character substitution
  // that cannot be recombined to recreate `<script` (fixes CodeQL js/incomplete-multi-character-sanitization).
  return html
    .replace(/<(?=\s*\/?script\b)/gi, '&lt;')
    .replace(/\s+on([a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))/gi, ' data-$1');
}
