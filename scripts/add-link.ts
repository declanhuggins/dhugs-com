import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { ensureLinksTable, validateSlug, addShortLink } from './generate-redirects';

async function prompt(q: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  const ans = await rl.question(q);
  rl.close();
  return ans.trim();
}

async function main() {
  // CLI args
  const args: Record<string, string> = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : 'true';
      args[k] = v;
    }
  }

  let url = args.url || '';
  if (!url) url = await prompt('Target URL: ');
  if (!/^https?:\/\//i.test(url)) {
    console.error('Please provide a valid http(s) URL.');
    process.exit(1);
  }

  let custom = args.slug || '';
  if (!custom) custom = await prompt('Custom slug (optional, [a-z0-9]{4,}): ');
  if (custom && !validateSlug(custom)) {
    console.error('Invalid slug. Use lowercase letters/numbers, length >= 4.');
    process.exit(1);
  }

  // Ensure table and insert
  ensureLinksTable();
  const slug = addShortLink(url, custom || undefined);

  const base = String(process.env.BASE_URL || process.env.BASE_URL_2 || '');
  console.log('\nShort link created:');
  console.log('- slug:', slug);
  console.log('- target:', url);
  if (base) {
    console.log('- visit:', `${base.replace(/\/$/, '')}/${slug}`);
  } else {
    console.log('- visit:', `/<base-url>/${slug}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
