import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules", ".next", "db/migrations"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@game-core": path.resolve(__dirname, "./packages/game-core/src"),
      "@providers": path.resolve(__dirname, "./packages/providers/src"),
      "@ai-orchestration": path.resolve(__dirname, "./packages/ai-orchestration/src"),
      "@ai-orchestration/case-content": path.resolve(__dirname, "./packages/ai-orchestration/src/case-content"),
      "@ai-orchestration/orchestrator": path.resolve(__dirname, "./packages/ai-orchestration/src/orchestrator"),
      "@audio-client": path.resolve(__dirname, "./packages/audio-client/src"),
    },
  },
});
