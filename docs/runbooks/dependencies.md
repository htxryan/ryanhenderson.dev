# Dependency audit maintenance

The production CI gate runs `pnpm dedupe --check` and
`pnpm audit --audit-level=high` before building. Keep the lockfile deduplicated
and verify the full build, unit, browser, and Lighthouse suites after updates.

The September 2026 portfolio release updates Astro within version 6 and
Vitest/coverage within version 3, plus vulnerable transitive dependencies.
The following `pnpm.overrides` address dependencies held back by their parents:

- `tmp`: 0.2.6 or later fixes temporary-directory handling in Lighthouse CLI
  and its interactive editor dependency.
- `sharp`: 0.35.4 or later supplies patched libvips binaries for Astro's image
  processing dependency.
- `lighthouse`: 13.4.1 or later replaces Lighthouse CLI's pinned 12.6.1. Its
  newer Puppeteer browser tooling removes the unpatched `extract-zip`
  dependency ([GHSA-jmr9-qjv8-65gv](https://github.com/advisories/GHSA-jmr9-qjv8-65gv)).

These overrides do not suppress advisories or relax CI thresholds. Remove them
when upstream dependency ranges include the fixes and the same checks pass.
