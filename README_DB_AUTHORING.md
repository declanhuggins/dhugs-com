# DB-First Authoring (Cloudflare D1)

This project now uses Cloudflare D1 as the source of truth for all posts and albums. The site is statically generated, but build-time data comes directly from D1 (no more precompiled `search-data.json` or `posts-content.json`).

## Overview
Tables:
- `posts` (slug, type: `markdown|album`, title, author, excerpt, content, date_utc, timezone, width, thumbnail, download_url, timestamps)
- `tags` (unique tag names)
- `post_tags` (many-to-many join)

Build/runtime behavior:
- Build-time (Node): queries D1 via `wrangler d1 execute` to render static pages.
- Runtime (Edge/Worker): serves statically built output; no runtime DB reads for posts.
- Album images are listed from Cloudflare R2 via the Worker binding (`env.R2_ASSETS`) at runtime.

## Authoring Scripts
All scripts target Cloudflare remotely. Select environment with `CF_ENV=dev|prod` (defaults to `prod`). Binding is `D1_POSTS`.

### Upsert a Markdown Post
```bash
npm run db:upsert:post -- posts/my-article.md
```
Markdown file must have frontmatter:
```markdown
---
title: My Article Title
date: 2025-08-27 America/Chicago
tags: [Tag One, Tag Two]
author: Declan Huggins
excerpt: Short summary
width: medium
thumbnail: https://cdn.dhugs.com/medium/thumbnails/my-article.avif
---
Full markdown **content** here.
```
The script derives slug from filename.

### Upsert an Album
```bash
npm run db:upsert:album -- \
   --slug apr-25 \
   --title "April 25" \
   --date "2025-04-25 America/Chicago" \
   --author "Declan Huggins" \
   --tags "Photography, Travel" \
   --width large \
   --thumbnail https://cdn.dhugs.com/albums/2025/04/apr-25/thumbnail.avif
```
`content` is stored empty and type is `album`.

### Delete a Post (by path)
```bash
npm run db:delete:post -- YYYY/MM/slug
```
Removes pivot links then the post row.

## Migration From Filesystem
`db:ingest` remains for one-time bootstrapping from local content. After migrating:
- Remove the `albums/` folder from version control.
- Optionally stop committing `posts/` if you move fully to DB-managed markdown.

## Future Enhancements
- Add a small admin UI for browser-based post creation.
- Add revision history table.
- Implement soft-deletes with a `deleted_at` column instead of hard delete.
- Add year/month computed columns or indices for faster archive queries.
- KV-backed cache for album image metadata (width/height) to avoid repeated R2 head calls.

## Troubleshooting
- If export returns empty arrays, ensure you used the same binding and environment.
- If a tag list looks concatenated incorrectly, confirm no unintended `||` appears inside tag names.
- For schema changes, create a new migration and re-run `db:migrate:*` then adjust scripts.
