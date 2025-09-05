// Interactive publisher for a markdown post in ./posts
// Usage:
//   npm run publish:post  (prompts for file path if not provided)

const fs = require('fs');
const path = require('path');
const readline = require('node:readline');
const { execa } = require('execa');

function parseArgs() {
  const out = {};
  for (let i=2;i<process.argv.length;i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const v = process.argv[i+1] && !process.argv[i+1].startsWith('--') ? process.argv[++i] : 'true';
    out[k] = v;
  }
  return out;
}

async function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await new Promise(res => rl.question(q, (x)=>res(x)));
  rl.close();
  return ans.trim();
}

async function main() {
  const args = parseArgs();
  let file = args.file || args.f;
  if (!file) {
    const postsDir = path.join(process.cwd(), 'posts');
    console.log(`Posts folder: ${postsDir}`);
    const candidates = fs.existsSync(postsDir) ? fs.readdirSync(postsDir).filter(f=>f.endsWith('.md')) : [];
    if (candidates.length) {
      candidates.forEach((f,i)=>console.log(`${i+1}. ${f}`));
      const idx = parseInt((await prompt('Pick a file by index or press Enter to type a path: ')) || '0', 10);
      if (idx>=1 && idx<=candidates.length) file = path.join(postsDir, candidates[idx-1]);
    }
    if (!file) file = await prompt('Path to markdown file: ');
  }
  file = path.resolve(file);
  if (!fs.existsSync(file)) throw new Error('File not found: ' + file);

  // Reuse existing upsert script
  const cmd = ['npx','tsx','scripts/db-upsert-post.ts', file];
  await execa(cmd[0], cmd.slice(1), { stdio: 'inherit' });
  console.log('Post published:', file);
}

main().catch(err => { console.error(err); process.exit(1); });
