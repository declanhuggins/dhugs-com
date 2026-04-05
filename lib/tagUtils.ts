/**
 * Parse tags from various raw formats (JSON string, comma/pipe-delimited, nested arrays)
 * into a clean string[]. Handles all the serialization quirks from D1 and search index.
 */
export function parseTags(raw: unknown): string[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) {
    if (raw.length === 1) {
      const only = String(raw[0] ?? '').trim();
      if (only.startsWith('[')) {
        try {
          return (JSON.parse(only) as unknown[]).map(x => String(x));
        } catch {
          return [only];
        }
      }
    }
    return raw.map(x => String(x));
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return undefined;
    if (s.startsWith('[')) {
      try {
        return (JSON.parse(s) as unknown[]).map(x => String(x));
      } catch {
        // Fall through to delimiter parsing
      }
    }
    return s.split(/[,|]+/).map(x => x.trim()).filter(Boolean);
  }
  return undefined;
}

export function tagToSlug(tag: string): string {
  return tag.toLowerCase().replace(/ /g, '-');
}

export function slugToTag(slug: string): string {
  return slug.replace(/-/g, ' ');
}

export function formatTag(tag: string): string {
  return tag
    .split(' ')
    .map(word => {
      // Special handling for known acronyms.
      if (word.toLowerCase() === 'afrotc') {
        return 'AFROTC';
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
