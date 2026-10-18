import { describe, expect, it, vi } from 'vitest';
import { buildEdgeRoutes, createEdgeHandler, createRouteMatcher } from '../../lib/edge-routes';

const policy = buildEdgeRoutes({
  staticRoutes: ['/', '/portfolio', '/api/admin/albums', '/api/search-index', '/random'].map(page => ({ page })),
  dynamicRoutes: [
    { page: '/[year]', regex: '^/([^/]+?)(?:/)?$' },
    { page: '/[year]/[month]', regex: '^/([^/]+?)/([^/]+?)(?:/)?$' },
    { page: '/[year]/[month]/[slug]', regex: '^/([^/]+?)/([^/]+?)/([^/]+?)(?:/)?$' },
    { page: '/category/[tag]', regex: '^/category/([^/]+?)(?:/)?$' },
    { page: '/random/[slug]', regex: '^/random/([^/]+?)(?:/)?$' },
  ],
  redirects: [
    { internal: true, regex: '^(?:/((?:[^/]+?)(?:/(?:[^/]+?))*))/$' },
    { regex: '^(?!/_next)/resume(?:/)?$' },
  ],
  rewrites: { beforeFiles: [{ regex: '^/feed(?:/)?$' }], afterFiles: [], fallback: [] },
}, {
  routes: {
    '/2026': { dataRoute: '/2026.rsc' },
    '/2026/10': { dataRoute: '/2026/10.rsc' },
    '/2026/10/football': { dataRoute: '/2026/10/football.rsc' },
    '/category/caf%C3%A9': { dataRoute: '/category/caf%C3%A9.rsc' },
  },
  dynamicRoutes: {
    '/[year]': {}, '/[year]/[month]': {}, '/[year]/[month]/[slug]': {}, '/category/[tag]': {},
  },
});

describe('edge route guard', () => {
  const matches = createRouteMatcher(policy);
  it.each([
    '/', '/portfolio', '/portfolio/', '/2026', '/2026/10', '/2026/10/football',
    '/2026/10/football/', '/2026/10/football.rsc', '/api/admin/albums',
    '/api/search-index', '/random', '/random/football', '/resume/', '/feed',
    '/category/caf%C3%A9', '/category/caf%c3%a9', '/category/café',
  ])('preserves application route %s', path => {
    expect(matches(path)).toBe(true);
  });

  // Regression cases from production exceededCpu logs, including the encoded
  // paths used by scanners to reach the broad Next archive routes.
  it.each([
    '/.env', '/.git/config', '/production/.env', '/.aws/credentials', '/.pgpass',
    '/%252fstripe%252fwebhook_secret%252eenv', '/%252frest%252flogout',
    '/%252fapp%252fapi%252f%5b...route%5d%252froute.js', '/web/env%2ejs',
    '/insta-compose%2eyml', '/api/node/constant%2ejs', '/API/config%2ejs',
    '/payment_gateways/stripe%2eyaml', '/rest/variables', '/webdav/phpinfo%2ephp',
    '/debug%2esql%2ezip', '/restapi/%2eenv', '/orientdb-client/%2eenv',
    '/manifest%2ejson', '/log/%2eenv', '/js/contact_me%2ejs', '/server-status.php',
    '/secrets.yml', '/.cache/huggingface/token', '/inngest', '/dump.bak',
    '/data.db', '/clients.sql', '/backup.sql.bz2', '/missing/',
    '/2026/10/missing-album', '/category/missing', '/9999/99',
    '/2026%2f10%2ffootball', '/2026%252f10%252ffootball', '/%ZZ',
  ])('does not render missing route %s', path => {
    expect(matches(path)).toBe(false);
  });

  it('delegates unknown paths to static assets without invoking Next', async () => {
    const next = vi.fn(() => new Response('Next'));
    const missing = new Response('Prebuilt 404', { status: 404 });
    const env = { ASSETS: { fetch: vi.fn().mockResolvedValue(missing) } };
    const handler = createEdgeHandler(policy, next);
    const request = new Request('https://dhugs.com/web/env%2ejs');
    expect(await handler(request, env, {})).toBe(missing);
    expect(next).not.toHaveBeenCalled();
    expect(env.ASSETS.fetch).toHaveBeenCalledWith(request);
  });

  it('preserves the request body, headers, query, environment and context for APIs', async () => {
    const response = new Response('Authenticated by existing API');
    const next = vi.fn(() => response);
    const env = { ASSETS: { fetch: vi.fn() } };
    const context = {};
    const request = new Request('https://dhugs.com/api/admin/albums?test=1', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    expect(await createEdgeHandler(policy, next)(request, env, context)).toBe(response);
    expect(next).toHaveBeenCalledWith(request, env, context);
    expect(await request.text()).toBe('{}');
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  it('preserves client-navigation RSC headers and query', async () => {
    const next = vi.fn(() => new Response('RSC'));
    const env = { ASSETS: { fetch: vi.fn() } };
    const request = new Request('https://dhugs.com/2026/10/football?_rsc=test', { headers: { RSC: '1' } });
    await createEdgeHandler(policy, next)(request, env, {});
    expect(next).toHaveBeenCalledWith(request, env, {});
  });

  it('lets the asset binding serve files that are not application routes', async () => {
    const next = vi.fn();
    const asset = new Response('svg', { headers: { 'Content-Type': 'image/svg+xml' } });
    const env = { ASSETS: { fetch: vi.fn().mockResolvedValue(asset) } };
    expect(await createEdgeHandler(policy, next)(new Request('https://dhugs.com/icons/camera.svg'), env, {})).toBe(asset);
    expect(next).not.toHaveBeenCalled();
  });
});
