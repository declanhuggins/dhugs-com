// Auto-loaded for every `npm run` invocation via .npmrc node-options.
// Loads environment variables from .dev.vars (Cloudflare-style file) once.
try {
  require('fs').accessSync('.dev.vars');
  if (!global.__ENV_LOADED__) {
    require('dotenv').config({ path: '.dev.vars', override: false, quiet: true });
    global.__ENV_LOADED__ = true;
  }
} catch (_e) {
  // No local dev vars present; ignore.
}
