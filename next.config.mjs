const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk', 'pdf-parse', 'mammoth', 'xlsx'],
    // Never reuse the client-side router cache for dynamic routes — always refetch
    // on navigation so newly ingested deals appear immediately without a manual scan.
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
