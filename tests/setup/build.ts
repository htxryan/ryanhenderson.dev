import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Vitest globalSetup hook.
 *
 * Multiple test files assert against `dist/` after running `pnpm build`. If
 * each file ran its own build in `beforeAll`, parallel invocations would
 * race on the same output directory and intermittently fail (writing the
 * same files at the same time, or one finishing while another is mid-write).
 *
 * Solution: build exactly once for the whole test run, here, before any
 * suite collects. Individual tests read the already-built artifacts.
 */
export default function setup() {
  const root = resolve(__dirname, "..", "..");
  execSync("pnpm build", { cwd: root, stdio: "inherit" });
  const home = resolve(root, "dist", "index.html");
  if (!existsSync(home)) {
    throw new Error("Expected build to produce dist/index.html");
  }
}
