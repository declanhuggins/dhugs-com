// Admin API authentication — verifies Bearer token against ADMIN_API_TOKEN from Secrets Store.
import { getEnv } from './cloudflare';

export async function authenticateAdmin(request: Request): Promise<Response | null> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = auth.slice(7);

  try {
    const env = await getEnv();
    const raw = env.ADMIN_API_TOKEN;

    // SecretsStoreSecret has .get(), plain strings don't.
    // Try .get() first, fall back to String coercion.
    let expected: string;
    if (raw && typeof (raw as { get?: unknown }).get === 'function') {
      expected = await (raw as { get(): Promise<string> }).get();
    } else {
      expected = String(raw ?? '');
    }

    if (!expected || token !== expected) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (e) {
    console.error('Admin auth error:', e instanceof Error ? e.message : String(e));
    return new Response(JSON.stringify({ error: 'Auth service error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null; // Authentication passed
}
