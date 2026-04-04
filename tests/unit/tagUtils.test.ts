import { describe, it, expect } from 'vitest';
import { parseTags, tagToSlug, slugToTag, formatTag } from '../../lib/tagUtils';

describe('tagToSlug', () => {
  it('lowercases and replaces spaces with dashes', () => {
    expect(tagToSlug('Photography')).toBe('photography');
    expect(tagToSlug('Notre Dame')).toBe('notre-dame');
    expect(tagToSlug('Air Force ROTC')).toBe('air-force-rotc');
  });

  it('handles single-word tags', () => {
    expect(tagToSlug('travel')).toBe('travel');
    expect(tagToSlug('AFROTC')).toBe('afrotc');
  });

  it('handles empty string', () => {
    expect(tagToSlug('')).toBe('');
  });
});

describe('slugToTag', () => {
  it('replaces dashes with spaces', () => {
    expect(slugToTag('notre-dame')).toBe('notre dame');
    expect(slugToTag('air-force-rotc')).toBe('air force rotc');
  });

  it('handles single-word slugs', () => {
    expect(slugToTag('photography')).toBe('photography');
  });
});

describe('formatTag', () => {
  it('title-cases each word', () => {
    expect(formatTag('notre dame')).toBe('Notre Dame');
    expect(formatTag('photography')).toBe('Photography');
  });

  it('handles AFROTC as a special acronym', () => {
    expect(formatTag('afrotc')).toBe('AFROTC');
    expect(formatTag('air force afrotc')).toBe('Air Force AFROTC');
  });

  it('handles single character words', () => {
    expect(formatTag('a b c')).toBe('A B C');
  });
});

describe('parseTags', () => {
  it('returns undefined for null/undefined', () => {
    expect(parseTags(null)).toBeUndefined();
    expect(parseTags(undefined)).toBeUndefined();
  });

  it('parses JSON array string', () => {
    expect(parseTags('["Photography","Travel"]')).toEqual(['Photography', 'Travel']);
  });

  it('parses comma-delimited string', () => {
    expect(parseTags('Photography, Travel, Ireland')).toEqual(['Photography', 'Travel', 'Ireland']);
  });

  it('parses pipe-delimited string', () => {
    expect(parseTags('Photography|Travel|Ireland')).toEqual(['Photography', 'Travel', 'Ireland']);
  });

  it('handles already-parsed arrays', () => {
    expect(parseTags(['Photography', 'Travel'])).toEqual(['Photography', 'Travel']);
  });

  it('handles nested JSON in single-element array', () => {
    expect(parseTags(['["Photography","Travel"]'])).toEqual(['Photography', 'Travel']);
  });

  it('returns undefined for empty string', () => {
    expect(parseTags('')).toBeUndefined();
  });

  it('handles non-string non-array values', () => {
    expect(parseTags(42)).toBeUndefined();
    expect(parseTags(true)).toBeUndefined();
  });
});
