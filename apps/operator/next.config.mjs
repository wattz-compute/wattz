/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.youtube.com' },
    ],
  },
  webpack: (config) => {
    config.externals = config.externals || [];
    config.externals.push('pino-pretty', 'encoding', 'lokijs');
    return config;
  },
};

export default nextConfig;
