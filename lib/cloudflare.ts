// Thin wrapper around OpenNext's Cloudflare context for typed binding access.
// Returns null during build when bindings aren't available.
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function getEnv(): Promise<CloudflareEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as unknown as CloudflareEnv;
}

export async function getEnvSafe(): Promise<CloudflareEnv | null> {
  try {
    return await getEnv();
  } catch {
    return null;
  }
}
