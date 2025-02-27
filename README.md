# dhugs-com

dhugs-com is a personal website showcasing photo albums, posts, and various projects. It is built with Next.js and powered by React, offering a modern and responsive design.

## Features
- **Photo Albums:** Browse albums sorted by year and month.
- **Blog Posts:** Read and explore various posts.
- **Dynamic Routing:** Experience a seamless navigation with Next.js' file system routing.
- **Responsive Design:** Optimized for desktop and mobile devices.

## Technologies
- [Next.js](https://nextjs.org) for the React framework
- [React](https://reactjs.org) for building user interfaces
- [Tailwind CSS](https://tailwindcss.com) for styling
- Various npm libraries for enhanced functionality

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Generate redirects and build the project:
   ```bash
   npm run dev-build
   ```
   This command performs the following steps:
   - Runs the `generate-redirects` script to create or update the `_redirects` file based on the contents of `links.md`.
   - Generates the file structure tree and saves it to `file-structure.txt`.
   - Builds the project for production.

3. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Generate Redirects

The `generate-redirects` script dynamically generates the `_redirects` file based on the contents of `links.md`.

To run the script:
```bash
npm run generate-redirects
```

This will create or update the `_redirects` file with the appropriate redirects. Make sure to commit and push the `_redirects` file to trigger a new build on Cloudflare Pages.

## Generate Bulk Redirects

The `generate-bulk-redirects` script dynamically generates bulk redirects on Cloudflare based on the contents of `links.md`.

To run the script:
```bash
npm run generate-bulk-redirects
```

This will create or update the bulk redirects on Cloudflare. Ensure that your `.env.local` file contains the necessary environment variables (`AWS_REDIRECT_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `BASE_URL_1`, and `BASE_URL_2`).

## Setting Up Cloudflare Pages

1. Log in to the Cloudflare dashboard and select your account.
2. Go to **Workers & Pages** and click **Create**.
3. Select the **Pages** tab.
4. Connect to Git and select your GitHub account.
5. Select the repository for this project.
6. Select the **Next.js** framework preset.
7. Add the necessary environment variables for your project.

After setting up the Pages project, go to the new Pages worker and add `nodejs_compat` to the Compatibility flags.

## Environment Variables for S3 Bucket

To properly deploy and serve album images, set the following environment variables in your deployment environment:

- AWS_REGION=
- AWS_BUCKET_NAME=
- S3_ENDPOINT=
- AWS_ACCESS_KEY_ID=
- AWS_SECRET_ACCESS_KEY=

## Album Images

Album images are served from the S3 bucket with the following URL structure:

- Full-sized images: 
  https://cdn.dhugs.com/albums/[year]/[month]/[slug]/images/[filename]

- Thumbnails:
  https://cdn.dhugs.com/albums/[year]/[month]/[slug]/thumbnail.avif

## Tools

### Avifier Script

The avifier.sh script converts supported images (JPEG, PNG, CR2) to AVIF format using ImageMagick.

Dependencies:
- ImageMagick

Usage:
```bash
./tools/avifier.sh /path/to/source /path/to/destination
```

- Checks required arguments and supported file extensions.
- Retrieves image dimensions and file size for metadata.
- Outputs conversion status for each file.

## Contributing

Feel free to submit issues or pull requests. Follow the standard GitHub workflow.

## License

This project is licensed under the MIT License.
