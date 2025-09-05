// db-delete-post.ts
// Delete a post (and its tag links) by path from D1 (Option B maintenance)
// Usage:
//   CF_ENV=dev tsx scripts/db-delete-post.ts YYYY/MM/slug
//   CF_ENV=prod tsx scripts/db-delete-post.ts YYYY/MM/slug
import { execa } from 'execa';
import { createInterface } from 'node:readline';

async function main() {
  async function prompt(q: string): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(res => rl.question(q, ans => { rl.close(); res(ans); }));
  }
  let pathSeg = process.argv[2];
  while (!pathSeg) {
    const entered = await prompt('Path to delete (YYYY/MM/slug): ');
    if (!entered) continue;
    pathSeg = entered.trim();
  }
  const binding = process.env.D1_BINDING || 'D1_POSTS';
  const envName = process.env.CF_ENV || 'prod';
  const safe = pathSeg.replace(/'/g,"''");
  const sql = `DELETE FROM post_tags WHERE post_id IN (SELECT id FROM posts WHERE path='${safe}');\nDELETE FROM posts WHERE path='${safe}';`;
  const args = ['wrangler','d1','execute',binding,'--command',sql,'--remote','--env', envName];
  console.log('Deleting post', pathSeg);
  await execa('npx', args, { stdio: 'inherit' });
  console.log('Deleted.');
}

main().catch(e => { console.error(e); process.exit(1); });
