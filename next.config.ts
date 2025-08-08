import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev';

setupDevPlatform().catch(console.error);

import type { NextConfig } from "next";

if (!process.env.CDN_SITE) {
  throw new Error("CDN_SITE must be defined in .env.local");
}

const cdnHost = new URL(process.env.CDN_SITE).hostname;

const nextConfig: NextConfig = {
  trailingSlash: true,
  devIndicators: false,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: cdnHost,
        pathname: '/**',
      },
    ],
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      `img-src 'self' https: data: blob:`,
      "script-src 'self' 'unsafe-inline'", // adjust if adding analytics; prefer hashes nonces later
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ');
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
            // X-Frame-Options deprecated in favor of CSP frame-ancestors but still widely respected
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '0' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
        ]
      }
    ];
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