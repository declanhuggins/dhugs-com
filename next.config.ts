import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Enable Cloudflare bindings (D1, R2, KV) in local dev mode
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}

// Resolve CDN base for Next image config.
const rawCdn = process.env.CDN_SITE || 'https://cdn.dhugs.com';

let cdnHost: string;
try {
  const url = /^(https?:)?\/\//i.test(rawCdn) ? rawCdn : `https://${rawCdn}`;
  cdnHost = new URL(url).hostname;
} catch (e) {
  throw new Error(`CDN_SITE is not a valid URL/host: ${rawCdn}`);
}

const nextConfig: NextConfig = {
  trailingSlash: false,
  devIndicators: false,
  poweredByHeader: false,
  // Limit build workers to avoid SQLITE_BUSY when multiple workers hit the
  // wrangler D1 proxy concurrently during page data collection.
  experimental: {
    cpus: 3,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: cdnHost, pathname: '/**' },
    ],
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      `img-src 'self' https: data: blob:`,
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
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
