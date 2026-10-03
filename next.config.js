const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone is used for Docker / AI Studio, but on Vercel it should be omitted
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        pathname: '/**',
      },
    ],
  },
  webpack: (config) => {
    config.resolve.extensions = ['.js', '.jsx', '.json', '.ts', '.tsx', ...(config.resolve.extensions || [])];
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname),
      '@components': path.resolve(__dirname, 'components'),
      '@lib': path.resolve(__dirname, 'lib'),
    };
    return config;
  },
};

module.exports = nextConfig;
