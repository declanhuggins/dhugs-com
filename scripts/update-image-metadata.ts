// Replaced with R2 sidecar metadata generator.
// This script now delegates to scripts/r2-generate-album-meta.ts
import { execa } from 'execa';

async function main() {
  const albumArg = process.argv[2];
  const args = ['tsx','scripts/r2-generate-album-meta.ts'];
  if (albumArg) args.push(albumArg);
  console.log('[info] Generating R2 _meta.json for', albumArg || 'default roots');
  await execa('npx', args, { stdio: 'inherit' });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => { console.error(err); process.exit(1); });
}
