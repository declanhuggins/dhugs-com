import type { NextConfig } from "next";

if (!process.env.CDN_SITE) {
  throw new Error("CDN_SITE must be defined in .env.local");
}

const cdnHost = new URL(process.env.CDN_SITE).hostname;

const nextConfig: NextConfig = {
  trailingSlash: true,
  images: {
    domains: [cdnHost],
  },
};

export default nextConfig;