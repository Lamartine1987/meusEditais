
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      // Adicionado para permitir imagens do Stripe, se necessário para product_data
      {
        protocol: 'https',
        hostname: 'files.stripe.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
