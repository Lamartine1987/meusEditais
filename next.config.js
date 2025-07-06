
/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
  experimental: {
    // Packages like firebase-admin and stripe are not fully compatible with
    // webpack bundling. This option tells Next.js to treat these packages
    // as "external" on the server, loading them with a native Node.js
    // require() instead of bundling them. This resolves build warnings
    // and runtime errors.
    serverComponentsExternalPackages: [
      'firebase-admin',
      'stripe',
      'firebase',
    ],
  },
};

module.exports = nextConfig;
