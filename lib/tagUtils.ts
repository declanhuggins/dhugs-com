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
