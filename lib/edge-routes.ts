/** Routes that can use Next; everything else can use Workers Static Assets. */
export interface EdgeRoutes {
  paths: string[];
  patterns: string[];
}

interface RouteManifest {
  staticRoutes: { page: string }[];
  dynamicRoutes: { page: string; regex: string }[];
  redirects: { regex: string; internal?: boolean }[];
  rewrites: {
    beforeFiles: { regex: string }[];
    afterFiles: { regex: string }[];
    fallback: { regex: string }[];
  };
}

interface PrerenderManifest {
  routes: Record<string, { dataRoute?: string | null }>;
  dynamicRoutes: Record<string, unknown>;
}

function normalizePath(path: string): string {
  // Decode segments separately: an encoded slash must not become a route separator.
  return path.split('/').map(decodeURIComponent).map(encodeURIComponent).join('/').replace(/\/$/, '') || '/';
}

export function buildEdgeRoutes(routes: RouteManifest, prerender: PrerenderManifest): EdgeRoutes {
  const paths = new Set(routes.staticRoutes.map(route => route.page));
  for (const [path, route] of Object.entries(prerender.routes)) {
    paths.add(path);
    if (route.dataRoute) paths.add(route.dataRoute);
  }
  // This site's content is published by rebuilding its static cache. Do not let
  // arbitrary values for [year]/[month]/[slug] trigger on-demand DB reads/rendering.
  const dynamic = routes.dynamicRoutes.filter(route => !(route.page in prerender.dynamicRoutes));
  return {
    paths: [...paths].map(normalizePath).sort(),
    patterns: [
      ...dynamic,
      // Next's automatic trailing-slash redirect matches *every* URL. Including
      // it here would let all scanner requests through the guard again.
      ...routes.redirects.filter(route => !route.internal),
      ...routes.rewrites.beforeFiles,
      ...routes.rewrites.afterFiles,
      ...routes.rewrites.fallback,
    ].map(route => route.regex),
  };
}

export function createRouteMatcher(routes: EdgeRoutes) {
  const paths = new Set(routes.paths);
  const patterns = routes.patterns.map(pattern => new RegExp(pattern));
  return (pathname: string): boolean => {
    try {
      const normalized = normalizePath(pathname);
      return paths.has(normalized) || patterns.some(pattern => pattern.test(normalized));
    } catch {
      return false; // Malformed percent encoding is not an application route.
    }
  };
}

export function createEdgeHandler<Env extends { ASSETS: { fetch(request: Request): Promise<Response> } }, Context>(
  routes: EdgeRoutes,
  next: (request: Request, env: Env, context: Context) => Response | Promise<Response>,
) {
  const matches = createRouteMatcher(routes);
  return (request: Request, env: Env, context: Context) => {
    if (matches(new URL(request.url).pathname)) return next(request, env, context);
    // ASSETS also handles public files (including future ones) and the prebuilt
    // 404 page. Never bootstrap Next or query D1/R2 to reject a missing URL.
    return env.ASSETS.fetch(request);
  };
}
