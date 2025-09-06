// d1-local-copy.ts
// Copies the most recently modified local D1 SQLite file (dev) to a stable name `dev-d1.sqlite`
// so it can be easily opened in DB Browser for SQLite.
// Usage:
//   npm run db:copy:dev   -> just copy/symlink-ish snapshot
//   npm run db:view:dev   -> copy then launch DB Browser (macOS)

import fs from 'fs';
import path from 'path';

function findLatestSqlite(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sqlite') && !f.endsWith('-wal') && !f.endsWith('-shm'))
    .map(f => {
      const full = path.join(dir, f);
      return { file: full, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return entries[0]?.file || null;
}

function copyWithCompanions(srcBase: string, destBase: string) {
  fs.copyFileSync(srcBase, destBase);
  const companions = ['-wal', '-shm'];
  for (const suffix of companions) {
    const src = srcBase + suffix;
    if (fs.existsSync(src)) {
      try { fs.copyFileSync(src, destBase + suffix); } catch {}
    }
  }
}

async function main() {
  const baseDir = path.join('.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
  const latest = findLatestSqlite(baseDir);
  if (!latest) {
    console.error('No local D1 sqlite file found. Run a migration first (npm run db:migrate).');
    process.exit(1);
  }
  const dest = 'D1_POSTS.local.sqlite';
  copyWithCompanions(latest, dest);
  console.log(`Copied local D1 DB -> ${dest}`);
  console.log('Tables preview (first 5 rows of posts if available):');
  try {
    // Lazy require to avoid adding dependency.
    const { execSync } = await import('node:child_process');
    execSync(`sqlite3 ${dest} ".tables"`, { stdio: 'inherit' });
    execSync(`sqlite3 ${dest} "SELECT slug,title,date_utc FROM posts LIMIT 5;"`, { stdio: 'inherit' });
  } catch {
    console.log('sqlite3 CLI not available or error executing preview.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
