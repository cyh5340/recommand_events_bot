import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['apify-client', 'ai', '@ai-sdk/openai', 'zod'],
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
}

export default nextConfig
