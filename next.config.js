
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
  transpilePackages: ['recharts'],
  env: {
    // Garante que a chave da API do Firebase esteja disponível para o cliente Next.js
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  }
};

module.exports = nextConfig;
