// Shared HTTP client for admin API calls.
// Reads API endpoint from BASE_URL and token from ADMIN_API_TOKEN.
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

dotenv.config({ path: path.join(process.cwd(), '.env'), quiet: true } as Parameters<typeof dotenv.config>[0]);

function getBaseUrl(): string {
  const env = process.env.CF_ENV || 'prod';
  if (env === 'dev') return process.env.BASE_URL_DEV || process.env.BASE_URL || 'https://dev.dhugs.com';
  return process.env.BASE_URL || 'https://dhugs.com';
}

function getToken(): string {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) throw new Error('ADMIN_API_TOKEN not set in environment');
  return token;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
  };
}

export async function apiUpsertPost(post: {
  path: string;
  slug: string;
  type: 'markdown' | 'album';
  title: string;
  author: string;
  date_utc: string;
  timezone: string;
  excerpt?: string;
  content?: string;
  width?: string;
  thumbnail?: string;
  download_url?: string;
  tags?: string[];
}): Promise<{ ok: boolean; path: string }> {
  const res = await fetch(`${getBaseUrl()}/api/admin/posts`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(post),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ ok: boolean; path: string }>;
}

export async function apiDeletePost(postPath: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${getBaseUrl()}/api/admin/posts`, {
    method: 'DELETE',
    headers: headers(),
    body: JSON.stringify({ path: postPath }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ ok: boolean }>;
}

export async function apiUpsertAlbum(album: {
  slug: string;
  title: string;
  date_utc: string;
  timezone: string;
  author: string;
  tags?: string[];
  excerpt?: string;
  thumbnail?: string;
  download_url?: string;
  width?: string;
}): Promise<{ ok: boolean; path: string }> {
  const res = await fetch(`${getBaseUrl()}/api/admin/albums`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(album),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ ok: boolean; path: string }>;
}

export async function apiUploadFile(
  key: string,
  filePath: string,
  metadata?: { width?: string; height?: string; alt?: string },
): Promise<{ ok: boolean; uploaded: Array<{ key: string; size: number }> }> {
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer]), fileName);
  formData.append('key', key);
  if (metadata?.width) formData.append('file_width', metadata.width);
  if (metadata?.height) formData.append('file_height', metadata.height);
  if (metadata?.alt) formData.append('file_alt', metadata.alt);

  const res = await fetch(`${getBaseUrl()}/api/admin/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API upload error ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ ok: boolean; uploaded: Array<{ key: string; size: number }> }>;
}

export async function apiRevalidate(
  options: { paths?: string[]; all?: boolean },
): Promise<{ ok: boolean }> {
  const res = await fetch(`${getBaseUrl()}/api/admin/revalidate`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(options),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ ok: boolean }>;
}
