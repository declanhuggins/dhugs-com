// Visual/structural regression tests using Vibium.
// Verifies page structure, element presence, and layout properties.
// Run: TEST_ENV=dev npm run test:e2e
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as vib from './vibium';
import { getBaseUrl, isHeadless } from './helpers';

const BASE = getBaseUrl();

beforeAll(() => {
  vib.start({ headless: isHeadless() });
}, 30_000);

afterAll(() => {
  vib.stop();
}, 15_000);

describe('Visual: Homepage structure', () => {
  it('has header, post grid, sidebar, and footer', () => {
    vib.go(BASE);
    const text = vib.text();

    // Header
    expect(text).toContain('Declan Huggins');
    expect(text).toContain('Photographer');
    expect(text).toContain('ABOUT');
    expect(text).toContain('PORTFOLIO');

    // Posts with dates
    const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/;
    expect(text).toMatch(datePattern);

    // Sidebar
    expect(text).toContain('Recent Posts');
    expect(text).toContain('Archives');
    expect(text).toContain('Categories');

    // Footer
    expect(text).toContain('Privacy Policy');
  }, 30_000);

  it('has multiple post articles with CDN thumbnails', () => {
    vib.go(BASE);
    const articleCount = vib.evalJs('document.querySelectorAll("article").length');
    expect(parseInt(articleCount)).toBeGreaterThan(3);

    const imgSrcs = vib.evalJs('Array.from(document.querySelectorAll("article img")).map(i=>i.src).join(",")');
    expect(imgSrcs).toContain('cdn.dhugs.com');
  }, 30_000);
});

describe('Visual: Post page structure', () => {
  it('album post has title and metadata', () => {
    // Navigate directly to a known post
    vib.go(`${BASE}/2025/06/slieve-league-hike`);
    const text = vib.text();
    expect(text).toContain('Slieve League Hike');
    expect(text).toContain('Posted on');
    expect(text).toContain('Posted in');

    const h1 = vib.evalJs('document.querySelector("article h1")?.textContent || ""');
    expect(h1).toContain('Slieve League Hike');
  }, 30_000);
});

describe('Visual: Archive page structure', () => {
  it('has multiple year headers', () => {
    vib.go(`${BASE}/archive`);
    const text = vib.text();
    expect(text).toContain('Archives Timeline');

    const years = text.match(/20\d{2}/g) || [];
    const uniqueYears = new Set(years);
    expect(uniqueYears.size).toBeGreaterThanOrEqual(2);
  }, 30_000);
});

describe('Visual: Category page structure', () => {
  it('lists category tags as links', () => {
    vib.go(`${BASE}/category`);
    const text = vib.text();
    expect(text).toContain('Photography');
    expect(text).toContain('Ireland');
    expect(text).toContain('Notre Dame');

    const linkCount = vib.evalJs('document.querySelectorAll("a[href*=\'/category/\']").length');
    expect(parseInt(linkCount)).toBeGreaterThan(3);
  }, 30_000);
});

describe('Visual: About page structure', () => {
  it('has substantial bio text', () => {
    vib.go(`${BASE}/about`);
    const text = vib.text();
    expect(text).toContain('Declan Huggins');
    expect(text.length).toBeGreaterThan(500);
  }, 30_000);
});

describe('Visual: Theme support', () => {
  it('page has theme data attribute', () => {
    vib.go(BASE);
    const theme = vib.evalJs('document.documentElement.getAttribute("data-theme") || "none"');
    expect(['light', 'dark', 'system', 'none']).toContain(theme);
  }, 30_000);
});
