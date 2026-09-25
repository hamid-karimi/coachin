import path from "node:path";
import type { NextConfig } from "next";

// The monorepo root (one pnpm lockfile for the workspace).
const root = path.join(import.meta.dirname, "../..");

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker runtime image.
  output: "standalone",
  outputFileTracingRoot: root,
  turbopack: { root },
  // No "X-Powered-By: Next.js" banner.
  poweredByHeader: false,
  // Native `pnpm dev:web` has no Caddy in front: proxy the browser's /api calls to
  // the stack (API_INTERNAL_URL, .env.development). In Docker, Caddy routes /api first.
  async rewrites() {
    const api = process.env.API_INTERNAL_URL;
    if (process.env.NODE_ENV !== "development" || !api) return [];
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
};

export default nextConfig;
