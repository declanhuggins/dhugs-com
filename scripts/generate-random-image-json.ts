import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

// Reuse shape of AlbumImage (inlined to avoid import side effects)
interface AlbumImage { filename: string; largeURL: string; }

type AlbumIndex = Record<string, AlbumImage[]>;

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const albumIndexPath = path.join(process.cwd(), 'dist', 'data', 'album-index.json');
  if (!fs.existsSync(albumIndexPath)) {
    throw new Error("dist/data/album-index.json not found. Run 'npm run content:albumsIndex' first.");
  }
  const raw = await fsp.readFile(albumIndexPath, 'utf8');
  const index = JSON.parse(raw) as AlbumIndex;
  const allImages: AlbumImage[] = Object.values(index).flat().map(img => ({ filename: img.filename, largeURL: img.largeURL }));
  if (!allImages.length) {
    console.warn('[random-image] No images present in album index; writing placeholder.');
    const placeholder = { error: 'no-images' };
    const outPath = path.join(process.cwd(), 'public', 'random-image.json');
    await fsp.mkdir(path.dirname(outPath), { recursive: true });
    await fsp.writeFile(outPath, JSON.stringify(placeholder), 'utf8');
    return;
  }
  // Output just a flat list of URLs (original-quality where possible)
  const urls = allImages.map(i => i.largeURL.replace(/\/l\//, '/o/'));
  const outPath = path.join(process.cwd(), 'public', 'random-image.json');
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  await fsp.writeFile(outPath, JSON.stringify(urls), 'utf8');
  console.log(`[random-image] Wrote public/random-image.json with ${urls.length} URLs`);
}

main().catch(err => { console.error(err); process.exit(1); });
