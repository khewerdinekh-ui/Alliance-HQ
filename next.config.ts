import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Screenshot uploads for AI attendance import can be several MB.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
