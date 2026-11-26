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
  // Do not announce the framework in every response.
  poweredByHeader: false,
  // Browser protections on every page and API response. A content security policy is left
  // out on purpose: Next.js writes inline scripts that need per-request nonces, and a loose
  // policy would give a false sense of safety.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // The site is HTTPS-only (Fly redirects), so tell browsers to insist on it.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Nothing embeds the game in a frame.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The game uses the microphone and nothing else.
          { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=(), usb=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
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
