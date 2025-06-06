import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev';

setupDevPlatform().catch(console.error);

import type { NextConfig } from "next";

if (!process.env.CDN_SITE) {
  throw new Error("CDN_SITE must be defined in .env.local");
}

const cdnHost = new URL(process.env.CDN_SITE).hostname;

const nextConfig: NextConfig = {
  trailingSlash: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: cdnHost,
        pathname: '/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/resume',
        destination: '/2025/01/resume',
        permanent: true,
      },
      {
        source: '/minecraft',
        destination: '/2025/01/minecraft',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;