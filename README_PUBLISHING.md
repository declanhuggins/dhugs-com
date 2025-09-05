Publishing Workflow (D1 + R2)

Overview
- All posts and albums live in Cloudflare D1 (binding: D1_POSTS).
- Album images live in Cloudflare R2 (binding: R2_ASSETS).
- The app reads from D1/R2 at build/runtime. No local content is required once published.

R2 Bucket Structure
- o/ (original quality), s/ (small), m/ (medium), l/ (large)
- Within each size bucket the same logical tree exists:
  - albums/YYYY/MM/slug/
    - thumbnail.avif
    - images/IMG001.avif, IMG002.avif, ...
    - images/* (dimensions stored as object metadata)
  - portfolio/images/* — portfolio gallery
  - extras/about/* — page-specific images
  - extras/thumbnails/my-post-slug.avif — optional thumbnails for text posts (lists use /m/extras/thumbnails/...)

Notes on Metadata
- The publisher uploads originals under /o/... and stores width/height as custom object metadata (x-amz-meta-width/height).
- The runtime HEADs R2 objects to read custom metadata for dimensions; no sidecar files are used.

Album Publishing (Single)
1) Convert your PNGs to AVIFs (use tools/convert.sh) into a folder, e.g. ./out-avif
2) Run:
   npm run publish:album
   - Prompts for: AVIF folder, title, date (YYYY-MM-DD Timezone), author, tags, width (default large)
   - Lets you pick a thumbnail from the album; crops/resizes to 1400x950 (3:2)
   - Uploads originals to R2 at /o/albums/YYYY/MM/slug/images/
   - Uploads thumbnail to /o/albums/YYYY/MM/slug/thumbnail.avif
   - Generates small/medium/large variants for the album only
   - Embeds per-image dimensions as object metadata (width/height)
   - Upserts the album row in D1
3) Environments:
   CF_ENV=dev npm run publish:album   # publish to dev database
   CF_ENV=prod npm run publish:album  # publish to prod database

Batch Album Publishing
Folder layout on external drive:
  Root/
    YYYY/
      YYYY-MM-DD Title/
        Mmm D/ (PNG source)
        Avif/   (converted AVIFs)
        thumbnail.avif (optional, 3:2)

Run:
  npm run publish:albums:batch -- --root /Volumes/Drive/Photos --author "Your Name" --tz "America/Chicago" --tags "Photography"
  - Picks the Avif/ folder under each album dir
  - Uses YYYY-MM-DD from folder name for date and generates slug as mmm-dd
  - Uses thumbnail.avif if present; otherwise you will pick in the single publish script (not prompted in batch)
  - Use CF_ENV=dev|prod to choose environment.

Post Publishing (Markdown)
1) Add a markdown file to ./posts with frontmatter (title, date, author, etc.)
2) Run:
   npm run publish:post
   - Prompts to pick a file; inserts/updates the post in D1
   - Use CF_ENV=dev|prod to choose environment.

Sitemap
- Built during content step and saved to public/sitemap.xml and D1 (site_meta['sitemap.xml']).
- To re-generate:
  npm run content:sitemap              # CF_ENV controls environment (default prod)

Troubleshooting
- Ensure CDN_SITE is set in your environment (so album thumbnail URLs are correct in D1).
- If responsive variants aren’t appearing, re-run:
  npx tsx scripts/generate-image-versions.ts albums/YYYY/MM/slug/images
- If metadata is missing on some objects (older uploads), you can re-upload those files to refresh metadata.
