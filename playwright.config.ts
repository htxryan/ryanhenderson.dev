import { defineConfig, devices } from "@playwright/test";

/**
 * IV — Integration Verification: Playwright config.
 *
 * Behavioural cross-epic contracts that vitest+jsdom cannot prove (real
 * paint, real localStorage, real navigation, real CF Pages-style
 * `_redirects`). The vitest suite covers the static HTML contracts; this
 * suite covers what only a browser can verify.
 *
 * The web server is `astro preview`, which serves the built `dist/`. We do
 * NOT use `astro dev` — its dev-only middleware diverges from production
 * (e.g. injects HMR, doesn't apply `_redirects`). For redirects we run a
 * tiny Node server that emulates CF Pages's `_redirects` semantics — see
 * tests/iv/redirect-server.ts.
 *
 * Vitest globalSetup builds `dist/` for the unit suite. This config does
 * NOT build — `webServer.command` only serves what's already on disk, so
 * the caller is responsible for running `pnpm build` (or invoking the
 * Playwright suite via `pnpm test:iv`, which builds first).
 */
export default defineConfig({
  testDir: "./tests/iv",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "list" : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4321",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    command: "node tests/iv/preview-server.mjs",
    url: "http://127.0.0.1:4321/",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
