import 'dotenv/config';
import { getAlbumImages } from "../lib/album";

async function main() {
  const album = process.argv[2] || "o/albums/2025/06/slieve-league-hike/images";
  try {
    const images = await getAlbumImages(album, true);
    console.log("Album:", album);
    console.log("Count:", images.length);
    console.log(images.slice(0, 5));
  } catch (e) {
    console.error("Error:", (e as Error).message);
    process.exit(1);
  }
}

main();
