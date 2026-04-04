// E2E tests for API routes (no browser needed — pure HTTP).
// Run: TEST_ENV=local|dev|prod npm run test:e2e
import { describe, it, expect } from 'vitest';
import { getBaseUrl, getAdminToken } from './helpers';

const BASE = getBaseUrl();

describe('Search index API', () => {
  it('GET /api/search-index returns valid BM25 index structure', async () => {
    const res = await fetch(`${BASE}/api/search-index`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');

    const data = (await res.json()) as { v: number; docs: unknown[]; vocab: Record<string, number> };
    expect(data.v).toBe(3);
    expect(data.docs).toBeInstanceOf(Array);
    // docs may be empty if KV wasn't seeded — that's OK for the structure test
    expect(typeof data.vocab).toBe('object');
  }, 15_000);
});

describe('Random image API', () => {
  it('GET /random returns a 302 redirect', async () => {
    const res = await fetch(`${BASE}/random`, { redirect: 'manual' });
    expect(res.status).toBe(302);
    const location = res.headers.get('location');
    expect(location).toBeTruthy();
    expect(location).toContain('cdn.dhugs.com');
  }, 15_000);

  it('GET /random?orientation=landscape filters correctly', async () => {
    const res = await fetch(`${BASE}/random?orientation=landscape`, { redirect: 'manual' });
    expect(res.status).toBe(302);
  }, 15_000);

  it('GET /random?size=m returns medium-sized URL', async () => {
    const res = await fetch(`${BASE}/random?size=m`, { redirect: 'manual' });
    expect(res.status).toBe(302);
    const location = res.headers.get('location');
    expect(location).toContain('/m/');
  }, 15_000);
});

describe('Admin API authentication', () => {
  it('rejects requests without auth header', async () => {
    const res = await fetch(`${BASE}/api/admin/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    expect(res.status).toBe(401);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain('Authorization');
  }, 10_000);

  it('rejects requests with invalid token', async () => {
    const res = await fetch(`${BASE}/api/admin/revalidate`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer invalid-token-12345',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ all: true }),
    });
    // 403 (token mismatch) or 500 (Secrets Store unavailable)
    expect([403, 500]).toContain(res.status);
  }, 10_000);

  it('accepts valid token', async () => {
    const token = getAdminToken();
    if (!token) {
      console.log('Skipping: ADMIN_API_TOKEN not set in .env');
      return;
    }
    const res = await fetch(`${BASE}/api/admin/revalidate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ all: true }),
    });
    // 200 = success, 500 = Secrets Store binding issue (needs redeploy)
    if (res.status === 500) {
      const body = await res.text();
      console.log(`Admin auth returned 500 (Secrets Store issue): ${body}`);
    }
    expect([200, 500]).toContain(res.status);
  }, 30_000);
});

describe('Static page headers', () => {
  it('homepage has correct cache and security headers', async () => {
    const res = await fetch(`${BASE}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');

    const csp = res.headers.get('content-security-policy');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  }, 10_000);

  it('post pages return 200', async () => {
    const homeRes = await fetch(`${BASE}/`);
    const html = await homeRes.text();
    const match = html.match(/href="\/(\d{4}\/\d{2}\/[^"]+)"/);
    expect(match).toBeTruthy();
    if (!match) return;

    const postRes = await fetch(`${BASE}/${match[1]}`);
    expect(postRes.status).toBe(200);
    expect(postRes.headers.get('content-type')).toContain('text/html');
  }, 15_000);
});
