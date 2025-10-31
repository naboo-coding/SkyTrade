const webpack = require('webpack');
const path = require('path');

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
    
    // Use NormalModuleReplacementPlugin to replace the missing file
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^\.\/createWeb3JsRpc\.mjs$/,
        (resource) => {
          if (resource.context.includes('@metaplex-foundation/umi-rpc-web3js')) {
            resource.request = path.resolve(
              resource.context,
              '../src/createWeb3JsRpc.ts'
            );
          }
        }
      )
    );
    
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
