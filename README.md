# dhugs-com

dhugs-com is a personal website showcasing photo albums, blog posts, and various projects. Built with Next.js, React, and Tailwind CSS, it offers a modern, responsive design.

---

## Features

- **Photo Albums:** Browse albums sorted by year and month.
- **Blog Posts:** Read and explore written content.
- **Dynamic Routing:** Enjoy seamless navigation with Next.js routing.
- **Responsive Design:** Optimized for both desktop and mobile devices.

---

## Technologies

- [Next.js](https://nextjs.org): React framework for server-side rendering and static site generation.
- [React](https://reactjs.org): Library for building user interfaces.
- [Tailwind CSS](https://tailwindcss.com): Utility-first CSS framework for rapid UI development.
- Various npm libraries for enhanced functionality.

---

## Getting Started

1. **Install Dependencies:**

   ```bash
   npm install
   ```

2. **Create Boilerplate Files:**

   ### .env.local

   Create a `.env.local` file in the root directory with the following:

   ```plaintext
   AWS_REGION=your_aws_region
   AWS_BUCKET_NAME=your_aws_bucket_name
   S3_ENDPOINT=your_s3_endpoint
   AWS_ACCESS_KEY_ID=your_aws_access_key_id
   AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
   AWS_ACCESS_KEY_ID_WRITE=your_aws_access_key_id_write
   AWS_SECRET_ACCESS_KEY_WRITE=your_aws_secret_access_key_write
   AWS_REDIRECT_API_KEY=your_aws_redirect_api_key
   CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
   BASE_URL=your_base_url
   BASE_URL_2=your_base_url_2
   CDN_SITE=your_cdn_site
   ```

   ### links.md

   Create a `links.md` file in the `links` directory with the following content:

   ```markdown
   ---
   example-key: https://example.com
   another-key: https://another-example.com
   ---
   ```

3. **Build & Run:**

   Run helper scripts and build the project:

   ```bash
   npm run dev-build
   ```

   Then start the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

Ensure the following variables are correctly set in your deployment environment:

- **AWS_REGION**
- **AWS_BUCKET_NAME**
- **S3_ENDPOINT**
- **AWS_ACCESS_KEY_ID**
- **AWS_SECRET_ACCESS_KEY**
- **CDN_SITE** – Base URL for the Content Delivery Network (e.g., `https://cdn.example.com`).

---

## Album Images

Album images are retrieved from an S3 bucket and served via CDN. The URL structure is:

- **Full-sized images:**  
  `${CDN_SITE}/albums/[year]/[month]/[slug]/images/[filename]`

- **Thumbnails:**  
  `${CDN_SITE}/albums/[year]/[month]/[slug]/thumbnail.avif`

- **Part-sized images:**  
  `${CDN_SITE}/[small || medium || large]/${imgPath}`

---

##  Cloudflare Pages

### Setting Up Cloudflare Pages

1. Log in to the Cloudflare dashboard.
2. Navigate to **Workers & Pages** and click **Create**.
3. Select the **Pages** tab and connect to your GitHub repository.
4. Choose the Next.js framework preset.
5. Add the necessary environment variables.
6. In the new Pages worker, add `nodejs_compat` to the Compatibility flags.

## Scripts & Tools

### Update Image Metadata

The `scripts/update-image-metadata.ts` script updates image metadata in the S3 bucket with dimensions using Sharp.

**Usage:**

```bash
npm run metadata
```

### Generate Image Versions

The `scripts/generate-image-versions.ts` script creates small, medium, and large versions of images. It processes images in `albums/`, `about/`, `portfolio/`, and `thumbnails/` directories, skipping images that already have resized versions.

**Usage:**

```bash
npm run images
```

### Precompile Posts

The `scripts/precompile-posts.mjs` script compiles markdown posts and album JSON data into a single JSON file (`data/posts.json`).

*(Run via Node directly as needed.)*

### Generate Sitemap

The `scripts/generate-sitemap.mjs` script dynamically creates a sitemap that includes static pages and posts. The sitemap is written to `public/sitemap.xml`.

**Usage:**

```bash
npm run generate-sitemap
```

### Bulk Redirects

The `scripts/generate-redirects.cjs` script sets up bulk redirects on Cloudflare using data from `links/links.md`.

**Usage:**

```bash
npm run generate-redirects
```

### Avifier Script

The `tools/avifier.sh` script converts supported image formats (JPEG, PNG, CR2) to AVIF using ImageMagick.

**Usage:**

```bash
./tools/avifier.sh /path/to/source /path/to/destination
```

---

## Contributing

Contributions are welcome! Please submit any issues or pull requests following the standard GitHub workflow.

---

## License

The code in this repository is licensed under the MIT License (or your chosen open source license). However, all photographs and other visual assets are not open source and are © Declan Huggins. These assets may not be reused or redistributed without explicit permission.

Vectors and icons by <a href="https://www.svgrepo.com" target="_blank">SVG Repo</a>
