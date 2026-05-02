# IV — Fitness functions and baseline values

This document is the source of truth for the cross-epic invariants the
Integration-Verification suite enforces. Each row names a fitness
function (an automated, repeatable measurement), the contract or
scenario it pins, the implementation, and a baseline value recorded on
2026-05-01 against the `rebuild` branch.

A fitness function fails the build when its measurement crosses its
threshold. Baselines below are the **observed** values; thresholds
(where they differ) are the lines the gate refuses to cross.

> **Re-decomposition trigger:** if any baseline drifts ≥10% in the
> wrong direction across two consecutive PR runs, the IV epic is
> reopened to investigate whether the cross-epic boundary that owns
> the regressed contract should be re-cut.

---

## 1. Performance & resource budgets

| # | Function | Contract | Where | Threshold | Baseline (2026-05-01) |
|---|---|---|---|---|---|
| F-1 | Lighthouse mobile **performance** on `/` | spec §6 S-12, U-20 | `lighthouserc.cjs` → `categories:performance` | ≥0.95 | 1.00 |
| F-2 | Lighthouse mobile **performance** on `/posts/hello-world/` | S-12 | same | ≥0.95 | 1.00 |
| F-3 | Lighthouse mobile **performance** on `/work/alpha/` | S-12 | same | ≥0.95 | 1.00 |
| F-4 | Home HTML gzipped size | U-20 | `tests/site-shell.test.ts` | <50 KB | (built; under budget) |
| F-5 | About HTML gzipped size | U-20 | `tests/site-shell.test.ts` | <50 KB | under budget |
| F-6 | Post HTML gzipped size | U-20 | `tests/post-route.test.ts` | <50 KB | under budget |
| F-7 | Tag-archive HTML gzipped size | U-20 (E6) | `tests/discovery.test.ts` | <50 KB | under budget |

## 2. Accessibility

| # | Function | Contract | Where | Threshold | Baseline |
|---|---|---|---|---|---|
| F-8 | Lighthouse mobile **accessibility** (home, post, project) | S-12 | `lighthouserc.cjs` | ≥0.95 | 1.00, 1.00, 1.00 |
| F-9 | axe-core (jsdom) — zero serious/critical on home, post, project, search | AC bullet "axe a11y smoke" | `tests/iv-a11y.test.ts` | 0 violations | 0 |
| F-10 | Skip link present and targets `#main` on home/about/404 | site-shell | `tests/site-shell.test.ts` | present | present |
| F-11 | Color-contrast — covered by Lighthouse a11y category in real-browser run | S-12 | `lighthouserc.cjs` | ≥0.95 | 1.00 |

## 3. SEO and external consumers

| # | Function | Contract | Where | Threshold | Baseline |
|---|---|---|---|---|---|
| F-12 | Lighthouse mobile **SEO** (home, post, project) | S-12 | `lighthouserc.cjs` | ≥0.95 | 1.00, 1.00, 1.00 |
| F-13 | Lighthouse mobile **best-practices** | S-12 | `lighthouserc.cjs` | ≥0.95 | 1.00 |
| F-14 | RSS 2.0 well-formed XML, `xmlns:content`, RFC 822 dates | C-7, S-10 | `tests/iv-feeds.test.ts` | strict | passes |
| F-15 | Atom 1.0 well-formed, `xmlns="http://www.w3.org/2005/Atom"`, RFC 3339 dates | parallel to C-7 | `tests/iv-feeds.test.ts` | strict | passes |
| F-16 | Sitemap 0.9 well-formed; one `<loc>` per published route; no draft slugs | C-8 | `tests/iv-feeds.test.ts` | strict | passes |
| F-17 | robots.txt declares the live sitemap-index URL | C-8 | `tests/iv-feeds.test.ts` | match | passes |
| F-18 | RSS, Atom, sitemap contain zero draft slugs (`draft-fixture`, `the-cost-of-estimation`) | C-2, advisory P1 #4 | `tests/iv-feeds.test.ts`, `tests/discovery.test.ts` | 0 | 0 |
| F-19 | Every published post + visible project has a 200 PNG OG card and `<meta og:image>` | C-10 | `tests/og.test.ts` | strict | passes |
| F-20 | Sitemap `<loc>` URLs are unique | C-8 | `tests/iv-feeds.test.ts` | unique | unique |

## 4. Behavioural cross-epic contracts (Playwright)

Source: `tests/iv/scenarios.spec.ts` (chromium project, `tests/iv/preview-server.mjs` emulating CF Pages `_redirects` + `_headers`).

| # | Scenario | Contract | Threshold | Baseline |
|---|---|---|---|---|
| F-21 | S-1 home renders without external script src bundles or pagefind hits | C-9, U-20 | strict | passes |
| F-22 | S-3 post route renders + `/feed.xml` serves the post | C-2, C-7 | strict | passes |
| F-23 | S-4 system dark-mode → frame-1 background dark, `data-theme=dark` set pre-paint | C-5 | strict | passes |
| F-24 | S-5 toggle flips theme; navigation + reload preserve via localStorage | C-5 | strict | passes |
| F-25 | S-6 Pagefind: zero asset bytes on home; loads on first interaction; results contain post/work links | C-9 | strict | passes |
| F-26 | S-7 `/hello-blog/` → 301 → `/posts/hello-blog/` rendered | C-11, U-24 | exact 301 | passes |
| F-27 | S-11 alpha shows GitHub repo link; bravo shows zero | E-3, U-8 | exact | passes |
| F-28 | CSP, nosniff, referrer policy applied to every response (preview-server) | C-12 | strict | passes |
| F-29 | Draft slugs return 404 on direct navigation | C-2 | 404 | 404 |

## 5. Build and deployment

| # | Function | Contract | Where | Threshold | Baseline |
|---|---|---|---|---|---|
| F-30 | `pnpm build` chains: content checks → token-gen → astro build → pagefind → CSP integrity | C-13 | `package.json#scripts.build` | clean | passes |
| F-31 | `pnpm deploy` wraps `pnpm install --frozen-lockfile && pnpm build` | C-13 | `package.json#scripts.deploy` | match | matches |
| F-32 | CSP integrity: every inline `<script>` body in `dist/` has a matching `sha256-…` source in `_headers`; no stale hashes | C-12 | `scripts/check-csp-hashes.mjs` | exact | passes (3 hashes) |
| F-33 | `_redirects` covers every REDIRECT row in `docs/migration/legacy-urls.txt`; every redirect target resolves in `dist/` | C-11 | `tests/migration.test.ts` | exact | passes |
| F-34 | `provision-cf.ts` second run against baseline-good state issues zero POST/PATCH | C-14 | `tests/iv-provision-cf.test.ts` | 0 writes | 0 writes |
| F-35 | `_headers` `script-src` includes `'wasm-unsafe-eval'` so Pagefind can boot on production | C-9 ↔ C-12 | `public/_headers` (manual review) | present | present |
| F-36 | Branch-conditional `X-Robots-Tag: noindex, nofollow` on `*.pages.dev` | advisory P1 #1, P2 #12 | `tests/deploy.test.ts` | present | passes |

## 6. Composition

| # | Function | Contract | Where | Threshold | Baseline |
|---|---|---|---|---|---|
| F-37 | BaseLayout chrome (`<header role="banner">`, `<footer role="contentinfo">`, canonical) renders on home, about, post, project, tag, search | C-6 | `tests/site-shell.test.ts`, `tests/portfolio.test.ts`, `tests/discovery.test.ts` | strict | passes |
| F-38 | OG template imports tokens from `src/styles/tokens.ts` (no parallel hex literal source) | C-4 | `tests/og.test.ts` | no `'#aabbcc'` literals | passes |
| F-39 | Tag URL slugs are lowercase (case-insensitive normalisation) | E6 archive | `tests/discovery.test.ts` | lowercase | lowercase |

---

## How baselines were captured (2026-05-01)

```bash
pnpm install
pnpm build
pnpm vitest run                       # 14 files, 358 tests passed
pnpm exec playwright test             # 10 tests passed
pnpm exec lhci autorun --config=lighthouserc.cjs
                                      # 3 URLs × 4 categories = 12 scores
                                      # all 1.00 (representative run)
```

LHCI raw report files live in `.lighthouseci/` (gitignored — re-run
locally to regenerate). The summary above pins the values that must be
defended, not the exact JSON.

## What this file is NOT

- It does not list **per-epic** acceptance criteria — those stay in the
  E1–E9 epic descriptions and their dedicated test files.
- It does not list **runtime** monitors — there is no synthetic check
  hitting production. The site is static; CF Pages handles availability.
- It does not snapshot timings — Lighthouse runs on a throttled mobile
  profile so its scores are stable enough to gate on. Wallclock measures
  (e.g. build duration) are not part of the contract.

## Re-running the IV suite

```bash
pnpm install
pnpm build                # required before vitest + playwright
pnpm vitest run           # ~3s, no browser
pnpm exec playwright test # ~3s with cached chromium
pnpm test:lhci            # ~30s; runs full Lighthouse on three URLs
```

If any score drifts below threshold:

1. Identify the originating epic via the contract column (or the test
   name's epic prefix).
2. File a bug bead with `bd create --type=bug` and link it to that
   epic. Per IV's bug-handling policy, do not patch only the consumer —
   the originating epic owns the broken contract.
