import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // A self-contained server in .next/standalone, so the Fly image carries only what it runs (ADR 0013).
  output: "standalone",
  // Note: cacheComponents and partialPrefetching are v16 experimental features.
  // Disabled here for compatibility with force-dynamic routes.

  // Turbopack is enabled by default in Next.js 16.
  // It reads path aliases directly from tsconfig.json paths — no extra config needed.
  // The webpack config below is retained as a fallback for environments that use webpack.
  turbopack: {},
  // Development only: lets the dev server send its scripts to pages opened at
  // 127.0.0.1 as well as localhost (used by the local browser checks). It has no
  // effect on production builds.
  allowedDevOrigins: ["127.0.0.1"],
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@game-core": path.resolve(__dirname, "packages/game-core/src"),
      "@providers": path.resolve(__dirname, "packages/providers/src"),
      "@ai-orchestration": path.resolve(__dirname, "packages/ai-orchestration/src"),
      "@audio-client": path.resolve(__dirname, "packages/audio-client/src"),
    };
    return config;
  },
};

export default nextConfig;
