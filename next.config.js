const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@metaplex-foundation/umi-rpc-web3js'],
  webpack: (config, { isServer }) => {
    // Add .mjs to resolve extensions
    config.resolve.extensions.push('.mjs', '.ts', '.tsx');
    
    // Handle .mjs files in node_modules
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
    });
    
    // Allow transpiling .ts files from node_modules/umi-rpc-web3js
    config.module.rules.push({
      test: /\.ts$/,
      include: /node_modules\/@metaplex-foundation\/umi-rpc-web3js/,
      use: [
        {
          loader: 'next/dist/compiled/babel/loader',
          options: {
            presets: ['next/babel'],
            cacheDirectory: true,
          },
        },
      ],
    });
    
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
