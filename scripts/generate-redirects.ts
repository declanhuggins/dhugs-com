// generate-redirects.ts: Sets up (or refreshes) Cloudflare Bulk Redirects from entries in links/links.md
// Usage: npm run content:redirects (ensure required env vars are set: AWS_REDIRECT_API_KEY, CLOUDFLARE_ACCOUNT_ID, BASE_URL, BASE_URL_2)
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { fileURLToPath } from 'node:url';

// Equivalent to __dirname in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_KEY = process.env.AWS_REDIRECT_API_KEY;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const BASE_URL = process.env.BASE_URL;
const BASE_URL_2 = process.env.BASE_URL_2;
if (!API_KEY || !ACCOUNT_ID || !BASE_URL || !BASE_URL_2) {
  console.error("Missing required environment variables.");
  process.exit(1);
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
    body: body ? JSON.stringify(body) : undefined
  });
  let data: CFAPIResult<T>;
  try {
    data = await res.json();
  } catch (e) {
    console.error('Failed to parse Cloudflare response JSON');
    throw e;
  }
  if (!data.success) {
    console.error('CF API error:', data.errors);
    throw new Error('Cloudflare API request failed');
  }
  return data.result;
}

async function getListIdByName(listName: string): Promise<string | null> {
  const listsUrl = `${CF_BASE_URL}/rules/lists`;
  const listsResult = await cfRequest<Array<{ id: string; name: string }>>(listsUrl, 'GET');
  const list = listsResult.find(l => l.name === listName);
  return list ? list.id : null;
}

async function deleteAllItemsFromList(listId: string) {
  const listItemsUrl = `${CF_BASE_URL}/rules/lists/${listId}/items`;
  const listItemsResult = await cfRequest<Array<{ id: string }>>(listItemsUrl, 'GET');
  const itemIds = listItemsResult.map(item => item.id);
  if (itemIds.length > 0) {
    console.log('Deleting existing items...');
    await cfRequest(listItemsUrl, 'DELETE', { items: itemIds.map(id => ({ id })) });
    console.log('Deleted all items.');
  }
}

async function getRulesetIdByPhase(phase: string): Promise<string | null> {
  const rulesetsUrl = `${CF_BASE_URL}/rulesets`;
  const rulesetsResult = await cfRequest<Array<{ id: string; phase: string }>>(rulesetsUrl, 'GET');
  const ruleset = rulesetsResult.find(r => r.phase === phase);
  return ruleset ? ruleset.id : null;
}

async function deleteLinkShortenerRule(rulesetId: string) {
  const rulesetUrl = `${CF_BASE_URL}/rulesets/${rulesetId}`;
  const rulesetData = await cfRequest<any>(rulesetUrl, 'GET');
  const filteredRules = rulesetData.rules.filter((rule: any) => rule.description !== 'link shortener');
  if (filteredRules.length < rulesetData.rules.length) {
    await cfRequest(rulesetUrl, 'PUT', {
      name: rulesetData.name,
      kind: rulesetData.kind,
      phase: rulesetData.phase,
      rules: filteredRules
    });
    console.log('Deleted existing link shortener rule only.');
  }
}

async function main() {
  const linksFilePath = path.join(__dirname, '../links/links.md');
  const fileContent = fs.readFileSync(linksFilePath, 'utf8');
  const { data } = matter(fileContent) as { data: Record<string, string> };
  
  const items = Object.entries(data).flatMap(([key, url]) => [
    {
      redirect: {
        source_url: `${BASE_URL}/${key}`,
        target_url: url.replace(/^“|”$/g, ''),
        status_code: 302
      }
    },
    {
      redirect: {
        source_url: `${BASE_URL_2}/${key}`,
        target_url: url.replace(/^“|”$/g, ''),
        status_code: 302
      }
    }
  ]);
  
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
    await deleteAllItemsFromList(listId);
  }
  
  const addItemsUrl = `${CF_BASE_URL}/rules/lists/${listId}/items`;
  console.log("Adding redirect items...");
  await cfRequest(addItemsUrl, 'POST', items);
  console.log("Added all items.");
  
  const phase = "http_request_redirect";
  let rulesetId = await getRulesetIdByPhase(phase);
  const rulesetPayload = {
    name: "default",
    kind: "root",
    phase: phase,
    rules: [
      {
        expression: `http.request.full_uri in $${LIST_NAME}`,
        description: "link shortener",
        action: "redirect",
        action_parameters: {
          from_list: {
            name: LIST_NAME,
            key: "http.request.full_uri"
          }
        }
      }
    ]
  };
  
  if (!rulesetId) {
    const rulesetUrl = `${CF_BASE_URL}/rulesets`;
    console.log("Creating Bulk Redirect Rule...");
    const rulesetResult = await cfRequest(rulesetUrl, 'POST', rulesetPayload);
    rulesetId = rulesetResult.id;
    console.log("Bulk Redirect Rule created with ID:", rulesetId);
  } else {
    console.log("Removing existing link shortener rule...");
    await deleteLinkShortenerRule(rulesetId);

    // Fetch the latest ruleset to preserve any other rules
    const rulesetUrl = `${CF_BASE_URL}/rulesets/${rulesetId}`;
    const existingRuleset = await cfRequest(rulesetUrl, 'GET');

    // Append the refreshed link shortener rule
    const updatedRules = [
      ...existingRuleset.rules,
      {
        expression: `http.request.full_uri in $${LIST_NAME}`,
        description: "link shortener",
        action: "redirect",
        action_parameters: {
          from_list: {
            name: LIST_NAME,
            key: "http.request.full_uri"
          }
        }
      }
    ];

    // Update ruleset with both preserved rules and the new link shortener rule
    await cfRequest(rulesetUrl, 'PUT', {
      name: existingRuleset.name,
      kind: existingRuleset.kind,
      phase: existingRuleset.phase,
      rules: updatedRules
    });
    console.log("Link shortener rule updated with ID:", rulesetId);
  }
  
  console.log('Bulk redirects have been set up successfully.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}