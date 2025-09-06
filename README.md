# dhugs-com — Architecture, Data, and Workflows

Static Next.js (App Router) site deployed to Cloudflare Workers via Wrangler. Content metadata lives in Cloudflare D1; images live in Cloudflare R2; the site builds to fully static assets and RSC payloads.

—

## Stack & Infra

- Next.js 15 (App Router), React 19, Tailwind
- Wrangler + Workers (static export served via Worker assets)
- D1 (binding `D1_POSTS`) for posts metadata
- R2 (binding `R2_ASSETS`) for originals and responsive variants
- Static assets served by Cloudflare ASSETS binding; CDN host: `CDN_SITE`

—

## Data Model (D1)

Tables
- `posts`: `path (YYYY/MM/slug)`, `slug`, `type ('markdown'|'album')`, `title`, `author`, `excerpt`, `content`, `date_utc`, `timezone`, `width ('small'|'medium'|'large')`, `thumbnail`, `download_url`, timestamps
- `tags`: unique tag names
- `post_tags`: many-to-many join between posts and tags

Build snapshot
- `npm run content:postsJson` writes `dist/data/posts.json`
- `npm run content:searchIndex` writes `dist/data/search-index.json` (BM25-like index)
- `npm run content:albumsIndex` writes `dist/data/album-index.json` (album images list). If R2 credentials are not available, this uses per‑album `_manifest.json` files at `o/<album>/images/_manifest.json` on the CDN. The `publish:portfolio` script writes the manifest for the `o/portfolio/images` album so portfolio content works without creds.

—

## R2 Layout

Mirrored size prefixes: `o/` (originals), `s/`, `m/`, `l/`.

- Album: `o/YYYY/MM/slug/thumbnail.avif` and `o/YYYY/MM/slug/images/*.avif`
- Portfolio: `o/portfolio/thumbnail.avif`, `o/portfolio/images/*`
- Metadata: per-object width/height stored as custom metadata

—

## Runtime & Build Behavior

- Pages are static by default (`dynamic = 'force-static'`).
- lib/posts.ts imports `dist/data/posts.json`; no runtime DB reads.
- lib/album.ts imports `dist/data/album-index.json`; no runtime bucket listing.
- Search happens entirely client-side: the search page fetches `/search-index.json` and ranks locally.
- SEO: per-page `generateMetadata` with Open Graph image (post thumbnail or fallback).
- Sitemap: `public/sitemap.xml` with trailing slashes, lastmod, and image entries.

—

## Scripts

Dev & build
- `dev`: Next dev with Turbopack
- `build:dev` / `build:prod`: run content generation → Next build → static export to `out/` → `wrangler build`
- `preview:dev` / `preview`: local Worker dev via Wrangler with asset serving from `out/`
- `deploy:dev` / `deploy`: deploy Worker via Wrangler

Content pipeline
- `content:redirects`: set bulk redirects and entry rule from `links/`
- `content:sitemap`: generate `public/sitemap.xml` and `public/robots.txt`
- `content:searchIndex`: write `dist/data/search-index.json`
- `content:postsJson`: write `dist/data/posts.json`
- `content:albumsIndex`: write `dist/data/album-index.json` (uses R2 listing when creds are present; otherwise reads per‑album manifests). `publish:portfolio` writes the portfolio manifest.

Publishing
- `publish:album`: single album (uploads to R2, pick thumbnail, generate variants, upsert D1)
- `publish:albums:batch`: batch importer from a root folder
- `publish:post`: upsert a markdown post into D1
- `prepare:album`: local helper to prep an album folder

DB utilities
- `db:migration:new` / `db:migrate` / `db:migrate:remote`: D1 schema changes
- `db:upsert:post` / `db:upsert:album` / `db:delete:post`: optional DB-first tools

CDN robots
- `cdn:robots:disallow` / `cdn:robots:allow`: upload robots.txt to R2 root for cdn.dhugs.com

—

## Publishing Workflows

Album (single)
1) Convert source into AVIFs (e.g., tools/ or external workflow)
2) `npm run publish:album` and follow prompts (AVIF folder, title, date, tags, width)
3) Script uploads originals to `o/YYYY/MM/slug/images`, sets thumbnail, generates `s/m/l` variants, and upserts D1

Album (batch)
- `npm run publish:albums:batch -- --root <drive> --author "..." --tz "..." --tags "..."`

Markdown post
- `npm run publish:post` and pick a file from `./posts` with frontmatter

Homepage thumbnail
- `npm run publish:home-thumb -- --file ./path/to/image.avif` uploads a single image and publishes:
  - `o/thumbnail.avif` (original/transcoded)
  - `s/thumbnail.avif` (320w), `m/thumbnail.avif` (640w), `l/thumbnail.avif` (1280w)
  The homepage Open Graph image uses the large tier at `${CDN_SITE}/l/thumbnail.avif`.

—

## Environment

`.env` (build-time, dev)
- `CDN_SITE=https://cdn.dhugs.com`
- `AWS_REGION=auto`
- `AWS_BUCKET_NAME=dhugs-assets`
- `S3_ENDPOINT=...r2.cloudflarestorage.com`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (read)
- `AWS_ACCESS_KEY_ID_WRITE`, `AWS_SECRET_ACCESS_KEY_WRITE` (write)
- `CLOUDFLARE_ACCOUNT_ID`, `BASE_URL`, `BASE_URL_2`

Cloudflare (Workers)
- Bindings configured in `wrangler.jsonc` (D1, R2, vars, secrets store). Scripts also use Wrangler for content tools.

—

## Project Structure

- `app/` — Next.js routes (App Router)
- `lib/` — content helpers (posts, album, markdown)
- `scripts/` — publishing + content generation tools
- `public/` — static assets (favicon, icons, sitemap, robots)
- `dist/data/` — generated content snapshots consumed at build/runtime (not public)

—

## SEO & Social

- Open Graph metadata on all key routes (og:image uses post thumbnail or portfolio fallback)
- Sitemap includes trailing slashes, lastmod per post, image entries
- Search page is `noindex`
- cdn.dhugs.com can be toggled for indexing via `cdn:robots:*`

—

## How to Run / Deploy

1) Fork and clone repo; `npm install`
2) Create `.env` with the variables above (for content tooling)
3) Generate content snapshots: `npm run content:all`
4) Local dev (Node): `npm run dev`
5) Local Worker preview (dev env): `npm run preview:dev`
6) Deploy dev: `npm run deploy:dev`
7) Deploy production: `npm run deploy`

—

## Troubleshooting

- Empty posts at build: ensure `CF_ENV` and D1 credentials are available for content scripts
- Missing album images at build: ensure `S3_ENDPOINT`, `AWS_*_WRITE`, and `AWS_BUCKET_NAME` are set; run `content:albumsIndex`
- cdn robots: toggle with `npm run cdn:robots:disallow` or `:allow`

—

## License

The code in this repository is licensed under the MIT License. However, all photographs and other visual assets are not open source and are © Declan Huggins. These assets may not be reused or redistributed without explicit permission.

Vectors and icons by <a href="https://www.svgrepo.com" target="_blank" rel="noopener noreferrer">SVG Repo</a>
