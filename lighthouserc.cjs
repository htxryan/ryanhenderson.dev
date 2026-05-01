/**
 * IV-2 — Lighthouse-CI configuration.
 *
 * Mobile-profile gates on the three hottest cross-epic routes:
 *   - /        (home — composition: BaseLayout + ProjectCard + nav)
 *   - /posts/hello-world/   (post route — Shiki + reading time)
 *   - /work/alpha/          (project route — ProjectCard detail surface)
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
        "http://127.0.0.1:4321/posts/hello-world/",
        "http://127.0.0.1:4321/work/alpha/",
      ],
      numberOfRuns: 1,
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
        "categories:performance": ["error", { minScore: 0.95 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.95 }],
        "categories:seo": ["error", { minScore: 0.95 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
    },
  },
};
