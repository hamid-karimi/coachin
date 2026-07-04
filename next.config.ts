import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      // Body-photo batches (up to 5 client-compressed images ≤1MB each)
      // exceed the 1MB default. Client pre-checks keep real payloads small.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
