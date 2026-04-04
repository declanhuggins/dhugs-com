# dhugs.com Lightroom Classic Publish Plugin

Two ways to publish albums to dhugs.com:

## Installation

1. Open Lightroom Classic
2. **File > Plug-in Manager > Add** -- select the `DhugsPublish.lrplugin` folder
3. Enable the plugin

## Option 1: Publish Service

Use Lightroom's built-in publish workflow with incremental sync.

1. **Library > Publish Services > Set Up** next to "dhugs.com"
2. Configure API endpoint, token, author, timezone, tags
3. Export format is locked to **JPEG** (max quality recommended) — the plugin converts to AVIF server-side
4. Create a Published Collection named `YYYY-MM-DD Album Title`
5. Drag photos in and click **Publish**

The plugin uploads originals to `/o/`, generates s/m/l responsive variants, creates a 3:2 thumbnail (AVIF + JPG), upserts album metadata, and revalidates the cache. Modified or added photos are handled on re-publish.

## Option 2: Folder Publish

Publish a pre-made folder of AVIFs directly.

1. **File > Plug-in Extras > Publish Album Folder...**
2. Browse to the folder (e.g. `.../2026-01-23 Album Title/AVIF/`)
3. Album URL, title, and date auto-populate from the folder name
4. Pick which image # to use as thumbnail
5. Click **Publish**

## R2 Structure

```
{o,s,m,l}/YYYY/MM/slug/
  images/001.avif, 002.avif ...
  thumbnail.avif
  thumbnail.jpg
```

All images are AVIF. The only JPGs are `thumbnail.jpg` at each size level.
