import { describe, it, expect } from 'vitest';
import { cdnResize, CDN_SIZE } from '../../lib/constants';

describe('cdnResize', () => {
  it('replaces /o/ with /l/ for large', () => {
    expect(cdnResize('https://cdn.dhugs.com/o/2025/06/slug/thumbnail.avif', 'large'))
      .toBe('https://cdn.dhugs.com/l/2025/06/slug/thumbnail.avif');
  });

  it('replaces /o/ with /m/ for medium', () => {
    expect(cdnResize('https://cdn.dhugs.com/o/2025/06/slug/images/photo.avif', 'medium'))
      .toBe('https://cdn.dhugs.com/m/2025/06/slug/images/photo.avif');
  });

  it('replaces /o/ with /s/ for small', () => {
    expect(cdnResize('https://cdn.dhugs.com/o/2025/06/slug/images/photo.avif', 'small'))
      .toBe('https://cdn.dhugs.com/s/2025/06/slug/images/photo.avif');
  });

  it('replaces /l/ back to /o/ for original', () => {
    expect(cdnResize('https://cdn.dhugs.com/l/2025/06/slug/images/photo.avif', 'original'))
      .toBe('https://cdn.dhugs.com/o/2025/06/slug/images/photo.avif');
  });

  it('handles URLs without scheme gracefully', () => {
    const result = cdnResize('/o/2025/06/slug/photo.avif', 'large');
    expect(result).toContain('/l/');
  });

  it('handles URLs with no size prefix (no-op)', () => {
    const url = 'https://cdn.dhugs.com/other/path.avif';
    expect(cdnResize(url, 'large')).toBe(url);
  });
});

describe('CDN_SIZE', () => {
  it('has all expected size prefixes', () => {
    expect(CDN_SIZE.original).toBe('/o/');
    expect(CDN_SIZE.large).toBe('/l/');
    expect(CDN_SIZE.medium).toBe('/m/');
    expect(CDN_SIZE.small).toBe('/s/');
  });
});
