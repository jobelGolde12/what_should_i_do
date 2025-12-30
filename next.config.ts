import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {}, // empty object is fine
  },
};

export default nextConfig;
