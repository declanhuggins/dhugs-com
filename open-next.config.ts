import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Use static assets for the incremental cache — serves build-time prerendered
// pages directly from Workers Static Assets. No R2 writes, no waitUntil(),
// no hanging requests. Revalidation is not supported (not needed — all content
// pages are force-static and update on deploy).
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
