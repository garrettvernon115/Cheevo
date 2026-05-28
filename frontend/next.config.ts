import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) for small Docker images.
  output: "standalone",
};

export default nextConfig;
