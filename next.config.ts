import type { NextConfig } from "next";

require('dotenv').config({ quiet: true });

// Resolve CDN base for Next image config. In Cloudflare Pages builds, Secrets
// are NOT injected into process.env at build time. Default to the canonical
// CDN host if the env var is unavailable so the build does not fail.
const rawCdn = process.env.CDN_SITE || 'https://cdn.dhugs.com';

let cdnHost: string;
try {
  // Ensure we accept plain hosts by normalizing to a URL first
  const url = /^(https?:)?\/\//i.test(rawCdn) ? rawCdn : `https://${rawCdn}`;
  cdnHost = new URL(url).hostname;
} catch (e) {
  throw new Error(`CDN_SITE is not a valid URL/host: ${rawCdn}`);
}

const nextConfig: NextConfig = {
  trailingSlash: true,
  devIndicators: false,
  poweredByHeader: false,
  images: {
    unoptimized: true, // Cloudflare Workers disallow Node image optimizer (new Function/eval)
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
        destination: '/2025/01/resume/',
        permanent: true,
      },
      {
        source: '/minecraft',
        destination: '/2025/01/minecraft/',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
initOpenNextCloudflareForDev();
