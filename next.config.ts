import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['apify-client', 'ai', '@ai-sdk/google', 'zod'],
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
}

export default nextConfig
