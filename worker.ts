/* eslint-disable @typescript-eslint/ban-ts-comment -- Generated modules may exist on incremental builds, so @ts-expect-error is not stable. */
// These modules are generated after Next's type-check step, before deployment.
// @ts-ignore -- OpenNext generates this module during build:prod/build:dev.
import next from './.open-next/worker.js';
// @ts-ignore -- build-edge-routes.ts generates this after the OpenNext build.
import routes from './.open-next/edge-routes.json';
import { createEdgeHandler } from './lib/edge-routes';

export default {
  fetch: createEdgeHandler<Cloudflare.Env, ExecutionContext>(routes, next.fetch),
} satisfies ExportedHandler<Cloudflare.Env>;

// Preserve OpenNext's entrypoints if bindings are added in the future.
// @ts-ignore -- OpenNext generates these exports during the build.
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js';
