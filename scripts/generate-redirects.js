// Usage: node scripts/push-bulk-redirects.js
// Ensure .env.local contains AWS_REDIRECT_API_KEY, CLOUDFLARE_ACCOUNT_ID, BASE_URL_1, and BASE_URL_2

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') }); // load env variables

const API_KEY = process.env.AWS_REDIRECT_API_KEY;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const BASE_URL_1 = process.env.BASE_URL_1; // First base URL
const BASE_URL_2 = process.env.BASE_URL_2; // Second base URL
if (!API_KEY || !ACCOUNT_ID || !BASE_URL_1 || !BASE_URL_2) {
  console.error("Missing AWS_REDIRECT_API_KEY, CLOUDFLARE_ACCOUNT_ID, BASE_URL_1, or BASE_URL_2 in .env.local");
  process.exit(1);
}

const LIST_NAME = "links"; // same as used in ruleset below

// Cloudflare API endpoints
const CF_BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}`;

// Helper: make API requests
async function cfRequest(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!data.success) {
    console.error("CF API error:", data.errors);
    process.exit(1);
  }
  return data.result;
}

async function getListIdByName(listName) {
  const listsUrl = `${CF_BASE_URL}/rules/lists`;
  const listsResult = await cfRequest(listsUrl, 'GET');
  const list = listsResult.find(list => list.name === listName);
  return list ? list.id : null;
}

async function deleteAllItemsFromList(listId) {
  const listItemsUrl = `${CF_BASE_URL}/rules/lists/${listId}/items`;
  const listItemsResult = await cfRequest(listItemsUrl, 'GET');
  const itemIds = listItemsResult.map(item => item.id);
  if (itemIds.length > 0) {
    console.log("Deleting existing items from the list...");
    await cfRequest(listItemsUrl, 'DELETE', { items: itemIds.map(id => ({ id })) });
    console.log("Deleted all existing items from the list.");
  }
}

async function getRulesetIdByPhase(phase) {
  const rulesetsUrl = `${CF_BASE_URL}/rulesets`;
  const rulesetsResult = await cfRequest(rulesetsUrl, 'GET');
  const ruleset = rulesetsResult.find(ruleset => ruleset.phase === phase);
  return ruleset ? ruleset.id : null;
}

async function main() {
  // Step A: Read links.md and build list items
  const linksFilePath = path.join(__dirname, '../links/links.md');
  const fileContent = fs.readFileSync(linksFilePath, 'utf8');
  const { data } = matter(fileContent);
  
  const items = Object.entries(data).flatMap(([key, url]) => [
    {
      redirect: {
        source_url: `${BASE_URL_1}/${key}`,
        target_url: url.replace(/^“|”$/g, ''), // ensure no surrounding quotes
        status_code: 302
      }
    },
    {
      redirect: {
        source_url: `${BASE_URL_2}/${key}`,
        target_url: url.replace(/^“|”$/g, ''), // ensure no surrounding quotes
        status_code: 302
      }
    }
  ]);
  
  // Step 1: Check if the Bulk Redirect List already exists
  let listId = await getListIdByName(LIST_NAME);
  if (!listId) {
    // Create a new Bulk Redirect List if it doesn't exist
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
    console.log(`List with name "${LIST_NAME}" already exists with ID: ${listId}`);
    // Delete all existing items from the list
    await deleteAllItemsFromList(listId);
  }
  
  // Step 2: Add items to the list
  const addItemsUrl = `${CF_BASE_URL}/rules/lists/${listId}/items`;
  console.log("Adding redirect items to the list...");
  await cfRequest(addItemsUrl, 'POST', items);
  console.log("Added all items to the list.");
  
  // Step 3: Check if a Bulk Redirect Rule already exists for the phase
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
    // Create a new Bulk Redirect Rule if it doesn't exist
    const rulesetUrl = `${CF_BASE_URL}/rulesets`;
    console.log("Creating Bulk Redirect Rule...");
    const rulesetResult = await cfRequest(rulesetUrl, 'POST', rulesetPayload);
    rulesetId = rulesetResult.id;
    console.log("Bulk Redirect Rule created with ID:", rulesetId);
  } else {
    // Update the existing Bulk Redirect Rule
    const updateRulesetUrl = `${CF_BASE_URL}/rulesets/${rulesetId}`;
    console.log("Updating Bulk Redirect Rule...");
    await cfRequest(updateRulesetUrl, 'PUT', rulesetPayload);
    console.log("Bulk Redirect Rule updated with ID:", rulesetId);
  }
  
  console.log("Bulk redirects have been set up successfully.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
