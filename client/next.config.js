/** @type {import('next').NextConfig} */
const fs = require('fs');
const path = require('path');

let hasCopiedJsdomStylesheet = false;

class EnsureJsdomStylesheetPlugin {

  apply(compiler) {
    compiler.hooks.afterEmit.tap('EnsureJsdomStylesheetPlugin', () => {
      if (hasCopiedJsdomStylesheet) {
        return;
      }

      const source = path.join(process.cwd(), 'node_modules', 'jsdom', 'lib', 'jsdom', 'browser', 'default-stylesheet.css');
      const browserDir = path.join(process.cwd(), '.next', 'browser');
      const dest = path.join(browserDir, 'default-stylesheet.css');

      try {
        fs.mkdirSync(browserDir, { recursive: true });
        fs.copyFileSync(source, dest);
        hasCopiedJsdomStylesheet = true;
      } catch (error) {
        console.warn('Failed to copy jsdom default stylesheet:', error);
      }
    });
  }
}

const nextConfig = {
  output: 'standalone',
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
  webpack(config, { isServer }) {
    if (isServer) {
      config.plugins = config.plugins || [];
      config.plugins.push(new EnsureJsdomStylesheetPlugin());
    }
    return config;
  },
};

module.exports = nextConfig; 