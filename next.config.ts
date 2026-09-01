import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      // Default is 1mb; avatar uploads are capped at 2MB plus multipart overhead.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
