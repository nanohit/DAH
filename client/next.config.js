/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ibb.co',
      },
    ],
  },
  async rewrites() {
    return process.env.NODE_ENV === 'production' 
      ? [] // В продакшене используем прямые запросы к бэкенду
      : [
          {
            source: '/api/:path*',
            destination: 'http://localhost:5001/api/:path*',
          },
        ];
  },
};

module.exports = nextConfig; 