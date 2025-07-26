
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
  // Adiciona a transpilação para o recharts, que é necessário para
  // que ele funcione corretamente com o Next.js.
  transpilePackages: ['recharts'],
  experimental: {
    // Packages like firebase-admin, stripe, and firebase are not fully
    // compatible with webpack bundling. This option tells Next.js to treat
    // these packages as "external" on the server, loading them with a
    // native Node.js require() instead of bundling them. This resolves
    // build warnings and runtime errors.
    serverComponentsExternalPackages: [
      'firebase-admin',
      'stripe',
      'firebase',
    ],
  },
};

module.exports = nextConfig;
