import { describe, it, expect } from 'vitest';
import { sanitizePathSegment } from '../../lib/sanitizeUrl';

describe('sanitizePathSegment', () => {
  it('allows valid alphanumeric segments', () => {
    expect(sanitizePathSegment('hello')).toBe('hello');
    expect(sanitizePathSegment('hello123')).toBe('hello123');
    expect(sanitizePathSegment('2025')).toBe('2025');
  });

  it('allows hyphens and underscores', () => {
    expect(sanitizePathSegment('my-slug')).toBe('my-slug');
    expect(sanitizePathSegment('my_slug')).toBe('my_slug');
    expect(sanitizePathSegment('a-b_c-d')).toBe('a-b_c-d');
  });

  it('rejects segments with spaces', () => {
    expect(sanitizePathSegment('hello world')).toBe('');
  });

  it('rejects segments with special characters', () => {
    expect(sanitizePathSegment('hello!')).toBe('');
    expect(sanitizePathSegment('../etc')).toBe('');
    expect(sanitizePathSegment('path/traversal')).toBe('');
    expect(sanitizePathSegment('<script>')).toBe('');
  });

  it('rejects empty string', () => {
    expect(sanitizePathSegment('')).toBe('');
  });

  it('allows uppercase letters', () => {
    expect(sanitizePathSegment('Hello')).toBe('Hello');
    expect(sanitizePathSegment('ABC')).toBe('ABC');
  });
});
