import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Permite builds isolados de QA sem disputar a pasta .next com um servidor dev aberto.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
