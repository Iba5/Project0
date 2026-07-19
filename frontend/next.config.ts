import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  // 1. Prevents cloud media compilation crashes from external links
  images: {
    unoptimized: true,
  },
  // 2. Forces Next.js 16 to skip empty environment connections on the build machine
  experimental: {
    missingSuspenseWithCSRBypass: true,
  } as any // Cast as any because some Next.js 16 types are strict in Turbopack
};

export default nextConfig;
