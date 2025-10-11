/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', port: '', pathname: '/**' },
    ],
  },
  // Unifica os pacotes das duas versões
  transpilePackages: ['lucide-react', 'recharts', 'class-variance-authority'],
};

module.exports = nextConfig;
