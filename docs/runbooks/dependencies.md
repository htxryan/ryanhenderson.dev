# Dependency audit maintenance

The production CI gate runs `pnpm dedupe --check` and
`pnpm audit --audit-level=high` before building. Keep the lockfile deduplicated
and verify the full build, unit, browser, and Lighthouse suites after updates.

The September 2026 portfolio release uses Astro 7 and MDX 8, with
Vitest/coverage on version 3. Astro 7.2.8 or newer addresses the AVIF image
processing advisory
([GHSA-26w7-cxv4-gfx2](https://github.com/advisories/GHSA-26w7-cxv4-gfx2));
the lockfile also resolves smol-toml to a version newer than 1.7.0 to fix
its malformed-TOML parsing advisory
([GHSA-7w5x-hrqm-74c2](https://github.com/advisories/GHSA-7w5x-hrqm-74c2)).
The Astro config explicitly retains the unified Markdown processor and
HTML-aware whitespace handling so the upgrade preserves the site's rendering.
Astro now requires patched Sharp binaries directly, so the Sharp override is
no longer needed. The theme script's CSP hash was refreshed for Vite 8's
minified output.

The following `pnpm.overrides` address dependencies held back by their parents:

- `tmp`: 0.2.6 or later fixes temporary-directory handling in Lighthouse CLI
  and its interactive editor dependency.
- `lighthouse`: 13.4.1 or later replaces Lighthouse CLI's pinned 12.6.1. Its
  newer Puppeteer browser tooling removes the unpatched `extract-zip`
  dependency ([GHSA-jmr9-qjv8-65gv](https://github.com/advisories/GHSA-jmr9-qjv8-65gv)).

These overrides do not suppress advisories or relax CI thresholds. Remove them
when upstream dependency ranges include the fixes and the same checks pass.
