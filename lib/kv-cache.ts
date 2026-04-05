// In-memory caching layer for Worker isolates.
//
// Pages are force-static — data only changes on deploy. The in-memory cache
// prevents D1/R2 queries on RSC navigations within the same isolate. On cold
// starts (new isolate), one D1 query is unavoidable and acceptable.
//
// KV is intentionally NOT used here. The free tier (100K reads, 1K writes/day)
// is too easy to exhaust on a site with client-side navigation. D1 free tier
// (5M reads/day) is far more generous for the occasional cold-start miss.

/** In-memory cache — survives within a single Worker isolate. */
const mem = new Map<string, { data: unknown; exp: number }>();

// Long TTL: data is static, only changes on deploy. Isolates typically live
// 30s–5min anyway, so this effectively means "cache for the isolate's lifetime".
const MEM_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Get a value from in-memory cache or compute it from the fetcher.
 * During build (no bindings), falls through directly to the fetcher.
 */
export async function kvGet<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = mem.get(key);
  if (cached && cached.exp > now) {
    return cached.data as T;
  }

  const data = await fetcher();
  mem.set(key, { data, exp: now + MEM_TTL });
  return data;
}
