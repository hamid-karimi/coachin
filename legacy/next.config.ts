import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      // Photo batches and GPX uploads exceed the 1MB default; clients
      // pre-compress and pre-check sizes so real payloads stay small.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
