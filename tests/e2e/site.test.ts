// E2E browser tests using Vibium CLI.
// Run: TEST_ENV=local|dev|prod npm run test:e2e
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

describe('Homepage', () => {
  it('loads with title, nav, posts, and sidebar', () => {
    vib.go(BASE);
    expect(vib.title()).toContain('Declan Huggins');

    const pageText = vib.text();
    expect(pageText).toContain('ABOUT');
    expect(pageText).toContain('PORTFOLIO');
    expect(pageText).toContain('RESUME');
    expect(pageText).toContain('Photography');
    expect(pageText).toContain('Recent Posts');
    expect(pageText).toContain('Archives');
    expect(pageText).toContain('Categories');
  }, 30_000);
});

describe('About page', () => {
  it('loads and has content', () => {
    vib.go(`${BASE}/about`);
    expect(vib.text()).toContain('Declan Huggins');
  }, 30_000);
});

describe('Portfolio page', () => {
  it('loads', () => {
    vib.go(`${BASE}/portfolio`);
    expect(vib.title()).toContain('Portfolio');
  }, 30_000);
});

describe('Archive page', () => {
  it('shows year groupings', () => {
    vib.go(`${BASE}/archive`);
    const pageText = vib.text();
    expect(pageText).toContain('Archives Timeline');
    expect(pageText).toMatch(/20\d{2}/);
  }, 30_000);
});

describe('Category page', () => {
  it('lists categories', () => {
    vib.go(`${BASE}/category`);
    const pageText = vib.text();
    expect(pageText).toContain('Categories');
    expect(pageText).toContain('Photography');
  }, 30_000);
});

describe('Author page', () => {
  it('lists authors', () => {
    vib.go(`${BASE}/author`);
    const pageText = vib.text();
    expect(pageText).toContain('Authors');
    expect(pageText).toContain('Declan Huggins');
  }, 30_000);
});

describe('Search page', () => {
  it('loads search results', () => {
    vib.go(`${BASE}/search?q=photography`);
    expect(vib.text()).toContain('Search Results');
  }, 30_000);
});

describe('Privacy policy', () => {
  it('renders', () => {
    vib.go(`${BASE}/privacy-policy`);
    expect(vib.text()).toContain('Privacy');
  }, 30_000);
});

describe('404 page', () => {
  it('returns custom 404 page', () => {
    vib.go(`${BASE}/nonexistent-page-xyz-123`);
    // Custom 404 has ASCII art and "No such file or directory"
    expect(vib.text()).toMatch(/No such file|error|not found|4\s*0\s*4/i);
  }, 30_000);
});

describe('Navigation flow', () => {
  it('can navigate About -> Category -> Recent', () => {
    vib.go(`${BASE}/about`);
    expect(vib.title()).toContain('About');

    vib.go(`${BASE}/category`);
    expect(vib.text()).toContain('Categories');

    vib.go(`${BASE}/recent`);
    expect(vib.text()).toContain('Declan Huggins');
  }, 45_000);
});
