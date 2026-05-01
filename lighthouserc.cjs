/**
 * IV-2 — Lighthouse-CI configuration.
 *
 * Mobile-profile gates on five cross-epic routes:
 *   - /                       (home — BaseLayout + ProjectCard + nav)
 *   - /posts/                 (post index)
 *   - /posts/hello-world/     (post route — Shiki + reading time)
 *   - /work/                  (work index)
 *   - /work/alpha/            (project detail — ProjectCard detail surface)
 *
 * Thresholds: ≥95 for performance, accessibility, best-practices, SEO.
 * Anything <95 fails the run. The numbers track spec §6 S-12 directly.
 *
 * Why mobile-only: production traffic for a personal site skews mobile,
 * and mobile is the strictest profile. Desktop gates would mask
 * regressions Mobile would catch.
 *
 * Server: tests/iv/preview-server.mjs (the same one the Playwright
 * suite uses), so what LHCI scores is exactly what CF Pages would serve.
 *
 * Bundle-size budgets (from a clean baseline run, 2026-05-01):
 *   - resource-summary:script  baseline 0 B (Astro static, no external <script src>)
 *     budget 25600 B (~25 KB). Effectively a "no-JS" gate — a regression
 *     adds bytes only if a future component imports a client script bundle.
 *   - resource-summary:total   baseline max 72,949 B (home).
 *     budget 92160 B (~90 KB). ~25% headroom over baseline.
 *   Score-95 alone won't catch slow payload creep; byte budgets do.
 */
module.exports = {
  ci: {
    collect: {
      startServerCommand: "node tests/iv/preview-server.mjs",
      startServerReadyPattern: "listening",
      // The server prints `[iv-preview] listening on …` once it's bound;
      // matching on that string is the explicit readiness signal.
      url: [
        "http://127.0.0.1:4321/",
        "http://127.0.0.1:4321/posts/",
        "http://127.0.0.1:4321/posts/hello-world/",
        "http://127.0.0.1:4321/work/",
        "http://127.0.0.1:4321/work/alpha/",
      ],
      // 3 runs + median aggregation: single-run mobile Lighthouse on
      // GH Actions runners is variance-prone (CPU jitter can drop a 100
      // perf score to 92), and we observed flakes at ≥95 thresholds.
      // Median across 3 runs is the standard LHCI fix.
      numberOfRuns: 3,
      settings: {
        preset: "desktop",
        // Override preset to mobile via formFactor + throttling.
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 412,
          height: 823,
          deviceScaleFactor: 1.75,
          disabled: false,
        },
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4,
        },
        // Skip the PWA category (we don't ship a manifest by design).
        onlyCategories: [
          "performance",
          "accessibility",
          "best-practices",
          "seo",
        ],
        // Run with a clean profile so prior state doesn't leak.
        chromeFlags:
          "--headless=new --no-sandbox --disable-dev-shm-usage --disable-gpu",
      },
    },
    assert: {
      assertions: {
        "categories:performance": [
          "error",
          { minScore: 0.95, aggregationMethod: "median" },
        ],
        "categories:accessibility": [
          "error",
          { minScore: 0.95, aggregationMethod: "median" },
        ],
        "categories:best-practices": [
          "error",
          { minScore: 0.95, aggregationMethod: "median" },
        ],
        "categories:seo": [
          "error",
          { minScore: 0.95, aggregationMethod: "median" },
        ],
        "resource-summary:script:size": [
          "error",
          { maxNumericValue: 25600, aggregationMethod: "median" },
        ],
        "resource-summary:total:size": [
          "error",
          { maxNumericValue: 92160, aggregationMethod: "median" },
        ],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
    },
  },
};
