import type { NextConfig } from 'next';
import path from 'node:path';

const baseConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '..'),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.slingacademy.com',
        port: ''
      }
    ]
  },
  transpilePackages: ['geist'],
  experimental: {
    optimizePackageImports: ['lucide-react', '@tabler/icons-react']
  },
  skipTrailingSlashRedirect: true,
  skipMiddlewareUrlNormalize: true
};

const nextConfig = baseConfig;
export default nextConfig;
