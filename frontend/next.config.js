/** @type {import('next').NextConfig} */
const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true';

const nextConfig = {
  // Standalone output for Docker production builds (disabled for Capacitor export)
  output: isCapacitorBuild ? 'export' : 'standalone',

  // Performance
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,

  images: {
    // Keep unoptimized for Capacitor compatibility; in web prod this can be enabled
    unoptimized: true,
  },

  // Next.js SWC minification is on by default in v13+; no explicit flag needed

  trailingSlash: true,

  ...(!isCapacitorBuild
    ? {
        async rewrites() {
          return [
            {
              source: '/api/:path*',
              destination: 'http://127.0.0.1:8000/api/:path*',
            },
          ];
        },
      }
    : {}),
};

module.exports = nextConfig;
