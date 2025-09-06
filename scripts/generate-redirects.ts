// generate-redirects.ts
// Refresh Cloudflare Bulk Redirects using the Rulesets Entrypoint API (latest practice).
// Usage: npm run content:redirects (env: CLOUDFLARE_API_TOKEN or AWS_REDIRECT_API_KEY, CLOUDFLARE_ACCOUNT_ID, BASE_URL, BASE_URL_2)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

require('dotenv').config({ quiet: true });

// Equivalent to __dirname in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_KEY = process.env.CLOUDFLARE_API_TOKEN || process.env.AWS_REDIRECT_API_KEY;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const BASE_URL = process.env.BASE_URL;
const BASE_URL_2 = process.env.BASE_URL_2;
if (!API_KEY || !ACCOUNT_ID || !BASE_URL || !BASE_URL_2) {
  console.warn("[redirects] Missing env (CLOUDFLARE_API_TOKEN or AWS_REDIRECT_API_KEY, CLOUDFLARE_ACCOUNT_ID, BASE_URL, BASE_URL_2). Skipping.");
  process.exit(0);
}

const LIST_NAME = "links";
const CF_BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}`;

type CFAPIMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface CFAPIResult<T = any> {
  result: T;
  success: boolean;
  errors?: Array<{ code: number; message: string; [k: string]: any }>;
}

async function cfRequest<T = any>(url: string, method: CFAPIMethod, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let text = '';
  try { text = await res.text(); } catch {}
  let data: CFAPIResult<T> | null = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!data || !('success' in data)) {
    console.error('CF API non-JSON or unexpected response:', { status: res.status, text: text?.slice(0, 500) });
    throw new Error('Cloudflare API request failed (non-JSON)');
  }
  if (!data.success) {
    console.error('CF API error:', data.errors, 'payload:', body);
    throw new Error('Cloudflare API request failed');
  }
  return data.result as T;
}

async function getListIdByName(listName: string): Promise<string | null> {
  const listsUrl = `${CF_BASE_URL}/rules/lists`;
  const listsResult = await cfRequest<Array<{ id: string; name: string }>>(listsUrl, 'GET');
  const list = listsResult.find(l => l.name === listName);
  return list ? list.id : null;
}

// Replacing entire list is simpler and avoids DELETE semantics differences
async function replaceAllItems(listId: string, items: any[]) {
  const url = `${CF_BASE_URL}/rules/lists/${listId}/items`;
  // Some endpoints expect the raw array for PUT (update all items)
  return await cfRequest(url, 'PUT', items);
}

// Use the Entrypoint API for http_request_redirect to add or update only our rule
async function upsertEntrypointRule(listName: string) {
  const entryUrl = `${CF_BASE_URL}/rulesets/phases/http_request_redirect/entrypoint`;
  const entry = await cfRequest<any>(entryUrl, 'GET');
  const rules = Array.isArray(entry?.rules) ? entry.rules : [];
  const desc = 'link shortener (managed by script)';
  const expr = `http.request.full_uri in $${listName}`;
  const template = {
    expression: expr,
    description: desc,
    action: 'redirect',
    action_parameters: {
      from_list: { name: listName, key: 'http.request.full_uri' }
    }
  };
  const idx = rules.findIndex((r: any) => r?.description === desc || r?.expression === expr);
  const next = idx >= 0 ? rules.map((r: any, i: number) => i === idx ? { ...r, ...template } : r) : [...rules, template];
  await cfRequest(entryUrl, 'PUT', { rules: next });
}

async function main() {
  // Ensure links table exists and read current links from D1
  ensureLinksTable();
  const rows = fetchLinksFromD1(); // { slug, url }

  // Start with any custom short-links from D1 (same behavior as before)
  const items = rows.flatMap(({ slug, url }) => {
    const clean = String(url).replace(/^“|”$/g, '');
    return [
      { redirect: { source_url: `${BASE_URL}/${slug}`, target_url: clean, status_code: 302, include_subdomains: false, subpath_matching: false } },
      { redirect: { source_url: `${BASE_URL_2}/${slug}`, target_url: clean, status_code: 302, include_subdomains: false, subpath_matching: false } },
    ];
  });

  // Hardcoded canonical redirects that must be environment-aware (prod/dev)
  // These use absolute URLs rooted at BASE_URL / BASE_URL_2, avoiding cross-domain targets.
  const builtIns: Array<{ path: string; targetPath: string; status: 308 }>
    = [
      { path: '/resume', targetPath: '/2025/01/resume', status: 308 },
      { path: '/minecraft', targetPath: '/2025/01/minecraft', status: 308 },
    ];

  const builtInItems = builtIns.flatMap(({ path, targetPath, status }) => [
    { redirect: { source_url: `${BASE_URL}${path}`,  target_url: `${BASE_URL}${targetPath}`,  status_code: status, include_subdomains: false, subpath_matching: false } },
    { redirect: { source_url: `${BASE_URL_2}${path}`, target_url: `${BASE_URL_2}${targetPath}`, status_code: status, include_subdomains: false, subpath_matching: false } },
  ]);

  // Merge with de-duplication by source_url; built-ins take precedence over D1 rows
  const bySource = new Map<string, (typeof items)[number]>();
  for (const it of items) bySource.set(it.redirect.source_url, it);
  for (const it of builtInItems) bySource.set(it.redirect.source_url, it);
  const finalItems = Array.from(bySource.values());
  
  let listId = await getListIdByName(LIST_NAME);
  if (!listId) {
    const createListUrl = `${CF_BASE_URL}/rules/lists`;
    const listPayload = {
      name: LIST_NAME,
      description: "Redirect list created via script.",
      kind: "redirect"
    };
    console.log("Creating Bulk Redirect List...");
    const listResult = await cfRequest(createListUrl, 'POST', listPayload);
    listId = listResult.id;
    console.log("Created list with ID:", listId);
  } else {
    console.log(`List "${LIST_NAME}" exists with ID: ${listId}`);
  }
  
  console.log("Upserting redirect items (replace all)...");
  if (finalItems.length === 0) {
    console.log("No links found in D1; leaving list empty.");
  } else {
    await replaceAllItems(listId!, finalItems);
    console.log("List items replaced.");
  }
  
  // Ensure/refresh just our rule at the entrypoint, preserving others
  console.log('Upserting entrypoint redirect rule...');
  await upsertEntrypointRule(LIST_NAME);
  console.log('Entrypoint rule updated.');
  
  console.log('Bulk redirects have been set up successfully.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

// ===== D1 helpers for short links =====

function d1Exec(sql: string, json = true): any[] | any {
  const binding = process.env.D1_BINDING || 'D1_POSTS';
  const envName = process.env.CF_ENV || 'prod';
  const remote = ['--remote','--env', envName];
  const base = ['wrangler','d1','execute', binding, '--command', sql];
  const args = json ? [...base, '--json', ...remote] : [...base, ...remote];
  const res = spawnSync('npx', args, { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(res.stderr || 'wrangler failed');
  if (!json) return res.stdout;
  const parsed = JSON.parse(res.stdout || '[]');
  let rows: any[] = [];
  if (Array.isArray(parsed)) {
    for (const part of parsed) {
      const maybe = (part as any);
      if (Array.isArray(maybe?.results)) { rows = maybe.results; break; }
      if (Array.isArray(maybe?.result)) { rows = maybe.result; break; }
    }
  } else {
    const maybe = parsed as any;
    if (Array.isArray(maybe?.results)) rows = maybe.results;
    else if (Array.isArray(maybe?.result)) rows = maybe.result;
  }
  return rows;
}

export function ensureLinksTable(): void {
  const sql = `CREATE TABLE IF NOT EXISTS links (
    slug TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );`;
  d1Exec(sql, false);
}

function fetchLinksFromD1(): Array<{ slug: string; url: string }> {
  const rows = d1Exec(`SELECT slug,url FROM links ORDER BY created_at DESC;`) as any[];
  return rows.map((r: any) => ({ slug: r.slug, url: r.url }));
}

function randomSlug(len = 4): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function validateSlug(s: string): boolean {
  return /^[a-z0-9]{4,}$/.test(s);
}

export function addShortLink(url: string, customSlug?: string): string {
  ensureLinksTable();
  let slug = (customSlug || '').trim().toLowerCase();
  if (slug && !validateSlug(slug)) throw new Error('Invalid custom slug (lowercase a-z and 0-9, length >= 4)');
  if (!slug) {
    let len = 4, attempts = 0;
    while (true) {
      const candidate = randomSlug(len);
      const exists = (d1Exec(`SELECT 1 FROM links WHERE slug='${candidate.replace(/'/g, "''")}';`) as any[]).length > 0;
      if (!exists) { slug = candidate; break; }
      attempts++; if (attempts > 20) { len++; attempts = 0; }
    }
  }
  const esc = (v: unknown) => `'${String(v).replace(/'/g, "''")}'`;
  d1Exec(`INSERT INTO links (slug,url) VALUES (${esc(slug)}, ${esc(url)})
          ON CONFLICT(slug) DO UPDATE SET url=excluded.url;`, false);
  return slug;
}
