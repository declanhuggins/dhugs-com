// Centralized constants for CDN paths, cache keys, and other shared values.

export const CDN_BASE =
  (typeof process !== 'undefined' && process.env?.CDN_SITE && /^https?:\/\//.test(process.env.CDN_SITE))
    ? process.env.CDN_SITE
    : 'https://cdn.dhugs.com';

/** CDN size-variant path prefixes */
export const CDN_SIZE = {
  original: '/o/',
  large: '/l/',
  medium: '/m/',
  small: '/s/',
} as const;

/** Replace a CDN size prefix in a URL */
export function cdnResize(src: string, size: keyof typeof CDN_SIZE): string {
  const target = CDN_SIZE[size];
  try {
    const u = new URL(src);
    return u.origin + u.pathname.replace(/\/(o|l|m|s)\//, target);
  } catch {
    return src.replace(/\/(o|l|m|s)\//, target);
  }
}

