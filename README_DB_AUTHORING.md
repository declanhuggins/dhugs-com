# Authoring, Data Model, and Scripts

This repository uses Cloudflare D1 (SQLite) for post metadata and Cloudflare R2 for images. The site builds fully static output with content snapshots produced at build-time.

For an end-to-end overview (infra, schema, workflows, scripts), see the main README: README.md.

Quick links
- D1 schema and queries: README.md → “Data Model (D1)”
- R2 bucket layout: README.md → “R2 Layout”
- Publishing workflows: README.md → “Publishing Workflows”
- Scripts cheat sheet: README.md → “Scripts”

DB-first utilities (optional)
- Upsert Markdown post: `npm run db:upsert:post -- posts/my-article.md`
- Upsert Album metadata: `npm run db:upsert:album -- --slug ... --title ... --date "YYYY-MM-DD TZ" ...`
- Delete post by path: `npm run db:delete:post -- YYYY/MM/slug`

Migrations
- Create migration: `npm run db:migration:new`
- Apply migration (local): `npm run db:migrate`
- Apply migration (remote env): `npm run db:migrate:remote`

Note: Bulk ingest scripts have been removed. Use `publish:*` commands for imports or regular publishing — they handle both R2 uploads and D1 upserts.
