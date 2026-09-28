import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is only for the self-hosted Docker build; Vercel does
  // its own file tracing/bundling and this mode breaks its build step.
  output: process.env.VERCEL ? undefined : "standalone",
  experimental: {
    serverActions: {
      // Vercel caps every serverless function's request body at 4.5MB, hard — this can only be
      // set below that wall, never above it. 4mb covers avatar uploads (2MB cap) and restoring a
      // database backup (src/app/admin/backup-actions.ts) with headroom for multipart overhead.
      // If a backup export ever approaches this, the fix is a direct-to-Blob client upload for
      // restore (bypassing the request-body path entirely), not a further bump here.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
