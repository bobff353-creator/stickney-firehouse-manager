import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't fail production builds on lint findings; type errors still block.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
