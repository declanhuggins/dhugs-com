import { describe, it, expect } from 'vitest';
import { markdownToSafeHtml, stripPotentiallyDangerousTags } from '../../lib/markdown';

describe('markdownToSafeHtml', () => {
  it('converts basic markdown to HTML', async () => {
    const html = await markdownToSafeHtml('# Hello World');
    expect(html).toContain('<h1>Hello World</h1>');
  });

  it('converts paragraphs', async () => {
    const html = await markdownToSafeHtml('This is a paragraph.');
    expect(html).toContain('<p>This is a paragraph.</p>');
  });

  it('supports GFM strikethrough', async () => {
    const html = await markdownToSafeHtml('~~deleted~~');
    expect(html).toContain('<del>deleted</del>');
  });

  it('supports GFM tables', async () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const html = await markdownToSafeHtml(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<td>1</td>');
  });

  it('sanitizes script tags', async () => {
    const html = await markdownToSafeHtml('<script>alert("xss")</script>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert');
  });

  it('sanitizes event handlers', async () => {
    const html = await markdownToSafeHtml('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain('onerror');
  });

  it('allows safe image attributes', async () => {
    const html = await markdownToSafeHtml('![alt text](image.jpg)');
    expect(html).toContain('<img');
    expect(html).toContain('alt="alt text"');
    expect(html).toContain('src="image.jpg"');
  });

  it('converts links with proper attributes', async () => {
    const html = await markdownToSafeHtml('[link](https://example.com)');
    expect(html).toContain('<a');
    expect(html).toContain('href="https://example.com"');
  });

  it('handles empty input', async () => {
    const html = await markdownToSafeHtml('');
    expect(html.trim()).toBe('');
  });

  it('handles bold and italic', async () => {
    const html = await markdownToSafeHtml('**bold** and *italic*');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('handles code blocks', async () => {
    const html = await markdownToSafeHtml('```\nconst x = 1;\n```');
    expect(html).toContain('<code>');
    expect(html).toContain('const x = 1;');
  });
});

describe('stripPotentiallyDangerousTags', () => {
  it('removes script tags', () => {
    expect(stripPotentiallyDangerousTags('<p>safe</p><script>evil()</script>'))
      .toBe('<p>safe</p>');
  });

  it('removes incomplete script tags', () => {
    expect(stripPotentiallyDangerousTags('<script src="evil.js">')).toBe('');
  });

  it('removes event handlers', () => {
    const input = '<img src="x" onerror="alert(1)" />';
    const output = stripPotentiallyDangerousTags(input);
    expect(output).not.toContain('onerror');
  });

  it('handles multiple dangerous patterns', () => {
    const input = '<div onclick="evil()"><script>bad()</script></div>';
    const output = stripPotentiallyDangerousTags(input);
    expect(output).not.toContain('script');
    expect(output).not.toContain('onclick');
  });

  it('preserves safe HTML', () => {
    const input = '<p>Hello <strong>world</strong></p>';
    expect(stripPotentiallyDangerousTags(input)).toBe(input);
  });

  it('handles empty string', () => {
    expect(stripPotentiallyDangerousTags('')).toBe('');
  });

  it('handles nested/recursive script patterns', () => {
    const input = '<scr<script>ipt>alert(1)</script>';
    const output = stripPotentiallyDangerousTags(input);
    expect(output).not.toContain('script');
    expect(output).not.toContain('alert');
  });
});
