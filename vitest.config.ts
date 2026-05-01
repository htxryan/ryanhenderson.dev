import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "~": resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
    // Build the site exactly once for the whole test run. Multiple test
    // files assert against `dist/`, and parallel `pnpm build` calls race
    // on the same output paths.
    globalSetup: ["./tests/setup/build.ts"],
    // The build itself can be slow (≈4s with content + Shiki); give the
    // hook room without bumping per-test timeouts.
    hookTimeout: 60_000,
  },
});
