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
    const isProduction = process.env.NODE_ENV === 'production';
    return [
      {
        source: '/api/:path*',
        destination: isProduction 
          ? 'https://dah-tyxc.onrender.com/api/:path*'
          : 'http://localhost:5001/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig; 