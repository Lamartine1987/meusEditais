/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', port: '', pathname: '/**' },
    ],
  },
  transpilePackages: ['lucide-react', 'recharts', 'class-variance-authority', 'react-day-picker'],
};

module.exports = nextConfig;
