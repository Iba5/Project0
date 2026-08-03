import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === 'production';
const backendApiUrl = process.env.BACKEND_API_URL || 'http://127.0.0.1:8000';

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async rewrites() {
    // In production, typically use direct API calls, but rewrites can be used for proxy
    // In development, proxy to local backend
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendApiUrl}/api/v1/:path*`,
      },
    ]
  },
  async headers() {
    const headers = [
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'on'
      },
      {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN'
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff'
      },
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block'
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin'
      },
      {
        key: 'Permissions-Policy',
        value: 'geolocation=(), microphone=(), camera=()'
      }
    ];

    // Only add HSTS in production with HTTPS
    if (isProduction) {
      headers.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload'
      });
    }

    return [
      {
        source: '/:path*',
        headers
      }
    ]
  }
};

export default nextConfig;
