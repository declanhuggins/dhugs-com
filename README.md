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
2. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Cloning the Repository

Clone the repository with:
   ```bash
   git clone https://github.com/declanhuggins/dhugs-com.git
   cd dhugs-com
   ```

## Build & Deployment

- To build:
   ```bash
   npm run build
   ```
- To start the production server:
   ```bash
   npm run start
   ```

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
