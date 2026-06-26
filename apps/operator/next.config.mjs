/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ['@wattz/sdk'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.youtube.com' },
    ],
  },
};

export default nextConfig;
