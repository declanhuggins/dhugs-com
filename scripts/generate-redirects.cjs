// generate-redirects.js: Sets up bulk redirects using Cloudflare's API.
// Usage: node scripts/push-bulk-redirects.js (ensure required env vars are set in .env.local)
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

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
    console.log("Deleting existing items...");
    await cfRequest(listItemsUrl, 'DELETE', { items: itemIds.map(id => ({ id })) });
    console.log("Deleted all items.");
  }
}

async function getRulesetIdByPhase(phase) {
  const rulesetsUrl = `${CF_BASE_URL}/rulesets`;
  const rulesetsResult = await cfRequest(rulesetsUrl, 'GET');
  const ruleset = rulesetsResult.find(ruleset => ruleset.phase === phase);
  return ruleset ? ruleset.id : null;
}

async function deleteLinkShortenerRule(rulesetId) {
  const rulesetUrl = `${CF_BASE_URL}/rulesets/${rulesetId}`;
  // Fetch current ruleset including its rules array
  const rulesetData = await cfRequest(rulesetUrl, 'GET');
  // Remove only the rule with description "link shortener"
  const filteredRules = rulesetData.rules.filter(rule => rule.description !== 'link shortener');
  if (filteredRules.length < rulesetData.rules.length) {
    // Update the ruleset with only allowed top-level fields
    await cfRequest(rulesetUrl, 'PUT', {
      name: rulesetData.name,
      kind: rulesetData.kind,
      phase: rulesetData.phase,
      rules: filteredRules
    });
    console.log("Deleted existing link shortener rule only.");
  }
}

async function main() {
  const linksFilePath = path.join(__dirname, '../links/links.md');
  const fileContent = fs.readFileSync(linksFilePath, 'utf8');
  const { data } = matter(fileContent);
  
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
  
  console.log("Bulk redirects have been set up successfully.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});