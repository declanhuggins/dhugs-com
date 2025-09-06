Publishing (D1 + R2)

For a complete, up-to-date guide, see README.md → “Publishing Workflows”. This file is kept minimal.

Summary
- Posts and albums: metadata in D1 (binding `D1_POSTS`).
- Images: originals under `o/YYYY/MM/slug/`; responsive variants under `s/`, `m/`, `l/` mirroring the same tree.
- Per-image width/height stored as object metadata in R2.

Core commands
- Single album: `npm run publish:album`
- Batch albums: `npm run publish:albums:batch -- --root <drive> --author "..." --tz "..." --tags "..."`
- Markdown post: `npm run publish:post`

Environment
- Choose DB env with `CF_ENV=dev|prod`.

Sitemap
- Generated during content step: `npm run content:sitemap`
