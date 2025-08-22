
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
  // A chave de API do Firebase agora está diretamente no código (src/lib/firebase.ts),
  // então não precisamos mais da configuração 'env' aqui.
};

module.exports = nextConfig;
