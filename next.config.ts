import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep a running dev server's files separate from `next build`, which uses `.next`.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
