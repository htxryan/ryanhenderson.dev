---
title: README
type: note
permalink: ryanhenderson.dev/proof/ryanhenderson.dev-wwy/readme
---

# Proof — ryanhenderson.dev (meta-epic `ryanhenderson.dev-wwy`)

Captured by `/prove-it remote` after the architect → infinity-loop run that closed all 10 domain epics + the IV epic in **2h 39m**, single-attempt across the board.

The site is built from the production output (`pnpm build` → `dist/`) and served by the same `tests/iv/preview-server.mjs` that the IV epic uses for its end-to-end suite. No dev-mode middleware. Screenshots are produced by `tests/iv/proof-shots.spec.ts`.

## Files

| # | File | What it proves |
|---|---|---|
| 01 | `01-home-light.png` | Home — brutalist mono, light mode, recent posts + featured work columns, ACTIVE/ARCHIVED status badges |
| 02 | `02-posts-archive-light.png` | `/posts/` archive — 4 posts, dates aligned left, hairline rules between rows |
| 03 | `03-post-hello-blog-light.png` | Migrated 2020 `hello-blog` post — preserved URL, PUBLISHED/READ/TAGS metadata block, prev/next nav |
| 04 | `04-post-hello-world-shiki-light.png` | Hello-world post — Shiki syntax highlighting via `cssVariables` mode + Callout MDX component |
| 05 | `05-about-light.png` | About page — ported from legacy `about.markdown` |
| 06 | `06-work-index-light.png` | `/work/` — "2 active · 1 archived", Alpha+Bravo (active) cards above Charlie (archived) |
| 07 | `07-work-alpha-light.png` | Project detail — `visit →` AND `repo →` (project has `repoUrl`) |
| 08 | `08-work-bravo-no-repo-light.png` | **E-3 contract:** project with no `repoUrl` renders only `visit →`, no broken/placeholder repo button |
| 09 | `09-tag-archive-meta-light.png` | `/tags/meta/` — cross-collection tag archive |
| 10 | `10-404-light.png` | 404 page (returns 404 status; brutalist styled) |
| 11 | `11-home-dark-system.png` | Home in **system-dark** mode (no flash; `prefers-color-scheme: dark`) — toggle reads `light` |
| 12 | `12-post-shiki-dark-system.png` | Post + Shiki in dark mode (single theme via `cssVariables`, advisory P2 #15) |
| 13 | `13-work-alpha-dark-system.png` | Project page in dark mode |
| 14 | `14-search-empty-light.png` | `/search/` initial state — placeholder input, zero pagefind bytes shipped (advisory P1 #10) |
| 15 | `15-search-results-hello-light.png` | Pagefind UI lazy-mounted, **brutalist-themed** results (mono, hairline rules, accent-color match highlight) |
| 16 | `16-mobile-home-light.png` | Mobile (390x844) — single-column flow, header collapses cleanly |
| 17 | `17-mobile-post-light.png` | Mobile post layout |
| 18 | `18-mobile-work-light.png` | Mobile portfolio |
| 19 | `19-home-after-toggle.png` | After clicking the theme toggle on the light-mode home |
| 20 | `20-work-after-toggle-persists.png` | Theme survives navigation (localStorage persistence — U-15) |
| 21 | `21-feed-rss.png` | `/feed.xml` — valid RSS 2.0 |
| 22 | `22-atom.png` | `/atom.xml` — Atom feed (kept by user choice; advisory recommended drop) |
| 23 | `23-sitemap.png` | `/sitemap-index.xml` |
| 24 | `24-og-cards-sample.png` | OG cards rendered: `/og/hello-world.png`, `/og/alpha.png`, `/og-default.png` (fallback) |

## Bug found and fixed during prove-it

While inspecting `15-search-results-hello-light.png`, Pagefind's drop-in UI was rendering with its default sans-serif theme + yellow highlight, breaking continuity with the brutalist tokens used everywhere else. Fixed by adding scoped `<style is:global>` overrides in `src/pages/search.astro` that bind Pagefind's CSS custom properties + per-element classes to the design system tokens (mono font, ink/paper, hairline rule color, accent for match highlight). Re-shot.

The bug was filed in beads at `ryanhenderson.dev-3wj` (or similar, see `bd list --type=bug`).

## How to reproduce

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm exec playwright test tests/iv/proof-shots.spec.ts
# Output lands in docs/proof/ryanhenderson.dev-wwy/
```

## Test totals

- 369 vitest tests pass
- 10 Playwright IV scenarios (`tests/iv/scenarios.spec.ts`) pass
- 7 Playwright proof-shot tests (`tests/iv/proof-shots.spec.ts`) pass
- Lighthouse mobile P/A/BP/SEO 1.00 across home/post/project (per IV-2)
- axe a11y zero serious/critical violations across home/post/project/search

## Run metadata

- Branch: `rebuild`
- Build: `pnpm install --frozen-lockfile && pnpm build && pnpm pagefind && pnpm check:csp-hashes`
- 19 HTML pages, 7 OG cards (+ 1 fallback), Pagefind index covering posts + projects
- Final commit before this proof: `93a473d IV [k9i] step 3: S-15 Jekyll-retired test + capture cross-epic lessons`