
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
    // Esta variável é populada pelo argumento de build no apphosting.yaml
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.GOOGLE_API_KEY_FOR_BUILD,
  }
};

// Log para verificar se a variável de ambiente está sendo lida durante o build
console.log('[next.config.js] GOOGLE_API_KEY_FOR_BUILD:', process.env.GOOGLE_API_KEY_FOR_BUILD ? 'Presente' : 'AUSENTE!!!');
console.log('[next.config.js] NEXT_PUBLIC_FIREBASE_API_KEY set to:', nextConfig.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'Presente' : 'AUSENTE!!!');


module.exports = nextConfig;
