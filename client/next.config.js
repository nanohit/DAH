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
    return [
      {
        source: '/api/:path*',
        destination: process.env.NODE_ENV === 'production'
          ? 'https://dah-backend.onrender.com/api/:path*'
          : 'http://localhost:5001/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig; 