/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
      // Ignore Node.js-only modules that shouldn't be bundled for the browser
      config.resolve.alias = {
        ...config.resolve.alias,
        'pino-pretty': false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;


