import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is only for the self-hosted Docker build; Vercel does
  // its own file tracing/bundling and this mode breaks its build step.
  output: process.env.VERCEL ? undefined : "standalone",
  experimental: {
    serverActions: {
      // Default is 1mb; avatar uploads are capped at 2MB plus multipart overhead.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
