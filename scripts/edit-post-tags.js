// Interactive CLI to edit tags for posts in D1
// - Iterates posts one-by-one (ordered by date desc)
// - For each post, shows all tags as a checkbox list with current ones pre-selected
// - On submit, adds/removes links in post_tags accordingly
// Usage:
//   CF_ENV=dev node scripts/edit-post-tags.js
//   CF_ENV=prod node scripts/edit-post-tags.js
//   CF_ENV=prod node scripts/edit-post-tags.js --start-slug my-slug

const { spawnSync } = require('node:child_process');
const { MultiSelect, Select } = require('enquirer');

function d1Exec(sql) {
  const binding = process.env.D1_BINDING || 'D1_POSTS';
  const envName = process.env.CF_ENV || 'prod';
  const args = ['wrangler','d1','execute',binding,'--command', sql, '--remote','--env', envName];
  const res = spawnSync('npx', args, { encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(res.stderr || 'wrangler failed');
  }
  return res.stdout;
}

function d1Query(sql) {
  const binding = process.env.D1_BINDING || 'D1_POSTS';
  const envName = process.env.CF_ENV || 'prod';
  const args = ['wrangler','d1','execute',binding,'--command', sql, '--json', '--remote','--env', envName];
  const res = spawnSync('npx', args, { encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(res.stderr || 'wrangler failed');
  }
  const parsed = JSON.parse(res.stdout || '[]');
  if (Array.isArray(parsed)) {
    for (const part of parsed) {
      if (Array.isArray(part?.results)) return part.results;
      if (Array.isArray(part?.result)) return part.result;
    }
  }
  if (Array.isArray(parsed?.results)) return parsed.results;
  if (Array.isArray(parsed?.result)) return parsed.result;
  return [];
}

function esc(v) { return v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`; }

async function promptContinueOrQuit() {
  const sel = new Select({
    name: 'next',
    message: 'Next action',
    choices: [
      { name: 'continue', message: 'Continue to next post' },
      { name: 'quit', message: 'Quit' },
    ],
    initial: 0,
  });
  try { return await sel.run(); } catch { return 'quit'; }
}

async function main() {
  const args = new Map();
  for (let i=2;i<process.argv.length;i++) {
    const a = process.argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = (process.argv[i+1] && !process.argv[i+1].startsWith('--')) ? process.argv[++i] : 'true';
      args.set(k, v);
    }
  }
  const startSlug = args.get('start-slug') || args.get('start') || null;

  // Fetch posts and tags
  const posts = d1Query(`SELECT id, slug, path, title, date_utc FROM posts ORDER BY date_utc DESC;`);
  const allTags = d1Query(`SELECT id, name FROM tags ORDER BY name COLLATE NOCASE ASC;`);
  const tagNames = allTags.map(t => String(t.name));
  if (!posts.length) { console.log('No posts found.'); return; }

  console.log(`Loaded ${posts.length} posts and ${allTags.length} tags.`);
  let idx = 0;
  if (startSlug) {
    const found = posts.findIndex(p => String(p.slug) === startSlug);
    if (found >= 0) idx = found;
  }

  for (; idx < posts.length; idx++) {
    const p = posts[idx];
    const pid = Number(p.id);
    const slug = String(p.slug);
    const title = String(p.title);
    const pathSeg = String(p.path || '');
    console.log(`\nPost ${idx+1}/${posts.length}: ${title} (${slug})${pathSeg?` [${pathSeg}]`:''}`);

    // Current tags for this post
    const current = d1Query(`SELECT t.name FROM post_tags pt JOIN tags t ON t.id=pt.tag_id WHERE pt.post_id=${pid} ORDER BY t.name COLLATE NOCASE ASC;`).map(r => String(r.name));

    // Show checkbox list
    const prompt = new MultiSelect({
      name: 'tags',
      message: 'Select tags (space to toggle, enter to save)',
      choices: tagNames,
      initial: tagNames.map((name, i) => current.includes(name) ? i : -1).filter(i => i >= 0),
      footer: '\nTip: type to filter; Ctrl+C to abort',
      // enable multiple columns if long; enquirer handles scrolling
    });
    let selected;
    try {
      selected = await prompt.run();
    } catch (e) {
      console.log('Aborted.');
      return;
    }
    selected = Array.isArray(selected) ? selected.map(String) : [];

    // Compute delta
    const toAdd = selected.filter(n => !current.includes(n));
    const toRemove = current.filter(n => !selected.includes(n));

    if (!toAdd.length && !toRemove.length) {
      console.log('No tag changes.');
    } else {
      const stmts = [];
      // ensure tags exist
      for (const n of toAdd) {
        const safe = n.replace(/'/g, "''");
        stmts.push(`INSERT INTO tags (name) VALUES ('${safe}') ON CONFLICT(name) DO NOTHING;`);
        stmts.push(`INSERT INTO post_tags (post_id, tag_id) SELECT ${pid}, t.id FROM tags t WHERE t.name='${safe}' ON CONFLICT(post_id, tag_id) DO NOTHING;`);
      }
      if (toRemove.length) {
        const namesList = toRemove.map(n => `'${n.replace(/'/g, "''")}'`).join(',');
        stmts.push(`DELETE FROM post_tags WHERE post_id=${pid} AND tag_id IN (SELECT id FROM tags WHERE name IN (${namesList}));`);
      }
      d1Exec(stmts.join('\n'));
      console.log(`Applied: +${toAdd.length} / -${toRemove.length}`);
    }

    const next = await promptContinueOrQuit();
    if (next === 'quit') break;
  }
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });

