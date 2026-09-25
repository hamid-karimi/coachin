import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker runtime image.
  output: "standalone",
  // No "X-Powered-By: Next.js" banner.
  poweredByHeader: false,
};

export default nextConfig;
