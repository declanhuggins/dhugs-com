// Backfill script to update album slugs to new rules and rename R2 objects.
// Dry-run by default. Use --apply to execute. Add --verbose for detailed logs.
// Usage:
//   node scripts/backfill-slugs-r2.js                     # dry run
//   node scripts/backfill-slugs-r2.js --apply             # perform changes
//   node scripts/backfill-slugs-r2.js --apply --verbose   # more output
//   CF_ENV=prod node scripts/backfill-slugs-r2.js --apply

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('node:child_process');
require('dotenv').config({ quiet: true });

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Legacy slugification used before backfill (apostrophes not stripped, & -> '-')
function legacySlugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function dateParts(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) throw new Error('Invalid date_utc: ' + iso);
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return { yyyy, mm };
}

function getR2BucketName() {
  if (process.env.R2_BUCKET_NAME) return process.env.R2_BUCKET_NAME;
  try {
    const cfg = fs.readFileSync(path.join(process.cwd(), 'wrangler.jsonc'), 'utf8');
    const m = cfg.match(/"bucket_name"\s*:\s*"([^"]+)"/);
    if (m) return m[1];
  } catch {}
  return 'dhugs-assets';
}

let __s3Client = null;
async function getS3Client() {
  if (__s3Client) return __s3Client;
  const { S3Client } = await import('@aws-sdk/client-s3');
  const endpoint = process.env.S3_ENDPOINT || process.env.AWS_S3_ENDPOINT || '';
  const region = process.env.AWS_REGION || 'auto';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID_WRITE || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY_WRITE || process.env.AWS_SECRET_ACCESS_KEY;
  __s3Client = new S3Client({ region, endpoint, forcePathStyle: true, credentials: (accessKeyId && secretAccessKey) ? { accessKeyId, secretAccessKey } : undefined });
  return __s3Client;
}

async function listKeys(prefix, verbose = false) {
  if (verbose) console.log(`[R2] Listing keys under: ${prefix}`);
  const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
  const s3 = await getS3Client();
  const Bucket = getR2BucketName();
  const out = [];
  let ContinuationToken = undefined;
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken }));
    (res.Contents || []).forEach(o => out.push(o.Key));
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);
  if (verbose) console.log(`[R2] Found ${out.length} keys under ${prefix}`);
  return out;
}

async function copyObject(srcKey, destKey, verbose = false) {
  if (verbose) console.log(`[R2] Copy ${srcKey} -> ${destKey}`);
  const { CopyObjectCommand } = await import('@aws-sdk/client-s3');
  const s3 = await getS3Client();
  const Bucket = getR2BucketName();
  const CopySource = `/${Bucket}/${encodeURI(srcKey)}`;
  await s3.send(new CopyObjectCommand({ Bucket, Key: destKey, CopySource }));
}

async function deleteObject(key, verbose = false) {
  if (verbose) console.log(`[R2] Delete ${key}`);
  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  const s3 = await getS3Client();
  const Bucket = getR2BucketName();
  await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
}

function d1Query(sql) {
  const binding = process.env.D1_BINDING || 'D1_POSTS';
  const envName = process.env.CF_ENV || 'prod';
  const cmd = ['wrangler','d1','execute',binding,'--command', sql,'--json','--remote','--env', envName];
  const res = spawnSync('npx', cmd, { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(res.stderr || 'wrangler failed');
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

function d1Exec(sql) {
  const binding = process.env.D1_BINDING || 'D1_POSTS';
  const envName = process.env.CF_ENV || 'prod';
  const cmd = ['wrangler','d1','execute',binding,'--command', sql, '--remote','--env', envName];
  const res = spawnSync('npx', cmd, { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(res.stderr || 'wrangler failed: ' + res.stderr);
}

async function main() {
  // Flags
  const argv = new Set(process.argv.slice(2));
  const apply = argv.has('--apply');
  const verbose = argv.has('--verbose') || argv.has('-v');
  const doRepair = argv.has('--repair') || argv.has('--repair-tiers');
  const cdn = process.env.CDN_SITE || '';
  if (verbose) console.log('[D1] Fetching album rows...');
  const rows = d1Query("SELECT id, slug, title, type, date_utc, thumbnail FROM posts WHERE type='album';");
  if (verbose) console.log(`[D1] Retrieved ${rows.length} album row(s).`);
  const changes = [];
  const repairs = [];
  for (const r of rows) {
    const currSlug = String(r.slug);
    const title = String(r.title || currSlug);
    const { yyyy, mm } = dateParts(String(r.date_utc));
    const newSlug = slugify(title);
    if (newSlug !== currSlug) {
      const oldPrefix = `o/albums/${yyyy}/${mm}/${currSlug}`;
      const newPrefix = `o/albums/${yyyy}/${mm}/${newSlug}`;
      const newPath = `${yyyy}/${mm}/${newSlug}`;
      const newThumb = cdn ? `${cdn}/${newPrefix}/thumbnail.avif` : (r.thumbnail ? String(r.thumbnail).replace(`/${oldPrefix}/`, `/${newPrefix}/`) : null);
      const change = { id: r.id, yyyy, mm, oldSlug: currSlug, newSlug, oldPrefix, newPrefix, newPath, newThumb, title };
      changes.push(change);
      if (verbose) {
        console.log(`
[PLAN] id=${change.id}
  title: ${change.title}
  date_utc: ${r.date_utc}
  old slug: ${change.oldSlug}
  new slug: ${change.newSlug}
  path:     ${change.newPath}
  old R2:   ${change.oldPrefix}/
  new R2:   ${change.newPrefix}/`);
      }
    } else if (doRepair) {
      // Already updated slug: try to repair tiers from legacy slug if present
      const legacy = legacySlugify(title);
      if (legacy && legacy !== currSlug) {
        const repair = { id: r.id, yyyy, mm, legacySlug: legacy, slug: currSlug, title };
        repairs.push(repair);
        if (verbose) {
          console.log(`
[REPAIR-PLAN] id=${repair.id}
  title: ${repair.title}
  date_utc: ${r.date_utc}
  slug (current): ${repair.slug}
  legacy slug:    ${repair.legacySlug}
  legacy R2 roots: [o|s|m|l]/albums/${yyyy}/${mm}/${legacy}
  new R2 roots:    [o|s|m|l]/albums/${yyyy}/${mm}/${currSlug}`);
        }
      }
    }
  }

  if (!changes.length && !repairs.length) { console.log('No changes needed.'); return; }
  if (changes.length) {
    console.log('Planned slug changes:', changes.length);
    for (const c of changes) console.log(`- ${c.yyyy}/${c.mm}: ${c.oldSlug} -> ${c.newSlug}`);
  }
  if (repairs.length) {
    console.log('Planned tier repairs (legacy -> current):', repairs.length);
    for (const r of repairs) console.log(`- ${r.yyyy}/${r.mm}: ${r.legacySlug} -> ${r.slug}`);
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to execute.');
    return;
  }

  // Execute changes one by one: rename R2 prefix then update D1
  for (const c of changes) {
    const t0 = Date.now();
    console.log(`\n[BEGIN] id=${c.id} ${c.yyyy}/${c.mm}: ${c.oldSlug} -> ${c.newSlug}`);

    // Handle all size tiers: o, s, m, l
    const sizes = ['o','s','m','l'];
    for (const tier of sizes) {
      const oldTierPrefix = `${tier}/albums/${c.yyyy}/${c.mm}/${c.oldSlug}`;
      const newTierPrefix = `${tier}/albums/${c.yyyy}/${c.mm}/${c.newSlug}`;
      console.log(`[R2] Renaming prefix (${tier}): ${oldTierPrefix} => ${newTierPrefix}`);

      const keys = await listKeys(oldTierPrefix + '/', verbose);
      if (!keys.length) {
        console.warn(`[WARN] No objects found under ${oldTierPrefix}/`);
        continue;
      }
      if (verbose) {
        const sample = keys.slice(0, Math.min(5, keys.length));
        console.log(`[R2] (${tier}) First ${sample.length} key(s):\n  - ${sample.join('\n  - ')}`);
        if (keys.length > sample.length) console.log(`[R2] (${tier}) ...and ${keys.length - sample.length} more`);
      }
      for (const k of keys) {
        const newKey = k.replace(oldTierPrefix + '/', newTierPrefix + '/');
        await copyObject(k, newKey, verbose);
      }
      for (const k of keys) { await deleteObject(k, verbose); }
    }

    // Update D1 row
    const newThumbSql = c.newThumb ? `'${String(c.newThumb).replace(/'/g, "''")}'` : 'NULL';
    const sql = `UPDATE posts SET slug='${c.newSlug.replace(/'/g, "''")}', path='${c.newPath.replace(/'/g, "''")}', thumbnail=${newThumbSql} WHERE id=${c.id};`;
    if (verbose) console.log(`[D1] ${sql}`);
    d1Exec(sql);
    const dt = ((Date.now() - t0) / 1000).toFixed(2);
    console.log(`[DONE] id=${c.id} updated. slug='${c.newSlug}', path='${c.newPath}' (${dt}s)`);
  }

  // Execute repairs: copy any leftover legacy tier keys to current, then delete old
  for (const r of repairs) {
    const t0 = Date.now();
    console.log(`\n[BEGIN REPAIR] id=${r.id} ${r.yyyy}/${r.mm}: ${r.legacySlug} -> ${r.slug}`);
    const sizes = ['o','s','m','l'];
    for (const tier of sizes) {
      const oldTierPrefix = `${tier}/albums/${r.yyyy}/${r.mm}/${r.legacySlug}`;
      const newTierPrefix = `${tier}/albums/${r.yyyy}/${r.mm}/${r.slug}`;
      const keys = await listKeys(oldTierPrefix + '/', verbose);
      if (!keys.length) {
        if (verbose) console.log(`[R2] (${tier}) No legacy keys at ${oldTierPrefix}/`);
        continue;
      }
      console.log(`[R2] (${tier}) Repair: ${oldTierPrefix} => ${newTierPrefix} (${keys.length} object(s))`);
      for (const k of keys) {
        const newKey = k.replace(oldTierPrefix + '/', newTierPrefix + '/');
        await copyObject(k, newKey, verbose);
      }
      for (const k of keys) await deleteObject(k, verbose);
    }
    const dt = ((Date.now() - t0) / 1000).toFixed(2);
    console.log(`[DONE REPAIR] id=${r.id} (${dt}s)`);
  }
  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
