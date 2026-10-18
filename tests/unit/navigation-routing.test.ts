import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { unstable_readConfig as readConfig } from 'wrangler';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { request } from 'node:http';

// Exercise Cloudflare's asset router as well as our route guard. Calling only
// createEdgeHandler misses navigation requests that never reach the Worker.
describe.each([undefined, 'dev'])('browser navigation routing (%s)', environment => {
  let runtime: Miniflare;
  let assets: string;
  async function fetchRoute(route: string, headers: Record<string, string> = {}) {
    const url = new URL(route, await runtime.ready);
    // fetch()/Undici rewrites Sec-Fetch-Mode to cors. Use HTTP to send the
    // browser's navigate header unchanged through the real asset router.
    return new Promise<Response>((resolve, reject) => {
      const req = request(url, { headers }, response => {
        const chunks: Buffer[] = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('error', reject);
        response.on('end', () => resolve(new Response(Buffer.concat(chunks), {
          status: response.statusCode,
          headers: Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key, String(value)])),
        })));
      });
      req.on('error', reject); req.end();
    });
  }

  beforeAll(async () => {
    const config = readConfig({ config: 'wrangler.jsonc', env: environment });
    assets = await mkdtemp(path.join(tmpdir(), 'dhugs-navigation-'));
    await Promise.all([
      writeFile(path.join(assets, '404.html'), '<h1>Not found</h1>'),
      writeFile(path.join(assets, 'asset.txt'), 'Static asset'),
    ]);
    const bundle = await build({
      stdin: {
        contents: `import { createEdgeHandler } from './lib/edge-routes';
          export default {fetch: createEdgeHandler({paths:['/', '/portfolio'],patterns:[]},
            request => new Response(request.headers.get('RSC') ? 'Page data' : '<h1>Homepage</h1>',
              {headers:{'X-Application-Route':'1'}}))};`,
        resolveDir: process.cwd(),
      },
      bundle: true, write: false, format: 'esm', platform: 'browser',
    });
    runtime = new Miniflare({
      modules: true, script: bundle.outputFiles[0].text,
      compatibilityDate: config.compatibility_date,
      compatibilityFlags: config.compatibility_flags,
      assets: {
        directory: assets, binding: config.assets!.binding,
        routerConfig: { has_user_worker: true },
        assetConfig: {
          not_found_handling: config.assets!.not_found_handling,
        },
      },
    });
    await runtime.ready;
  }, 30_000);

  afterAll(async () => {
    await runtime?.dispose();
    if (assets) await rm(assets, { recursive: true, force: true });
  });

  it.each(['/', '/portfolio'])('direct document navigation reaches the application: %s', async route => {
    const response = await fetchRoute(route, { 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document', Accept: 'text/html' });
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Application-Route')).toBe('1');
    expect(await response.text()).toContain('Homepage');
  });

  it('preserves in-site navigation requests', async () => {
    const response = await fetchRoute('/?_rsc=test', { RSC: '1' });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Page data');
  });

  it('keeps missing documents on the inexpensive static 404 path', async () => {
    const response = await fetchRoute('/nonexistent-page', { 'Sec-Fetch-Mode': 'navigate' });
    expect(response.status).toBe(404);
    expect(response.headers.has('X-Application-Route')).toBe(false);
    expect(await response.text()).toContain('Not found');
  });

  it('serves public files directly', async () => {
    const response = await fetchRoute('/asset.txt');
    expect(response.status).toBe(200);
    expect(response.headers.has('X-Application-Route')).toBe(false);
    expect(await response.text()).toBe('Static asset');
  });
});
