/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['@xenova/transformers', 'onnxruntime-node'],
  },
  webpack: (config) => {
    config.externals.push({ 'onnxruntime-node': 'commonjs onnxruntime-node' });
    return config;
  },
};

module.exports = nextConfig;