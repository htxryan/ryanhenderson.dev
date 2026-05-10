---
title: ryanhenderson.dev — Advisory Fleet Brief
date: 2026-04-30
spec: blog-portfolio-site.md
permalink: ryanhenderson.dev/specs/blog-portfolio-site-advisory-brief
---

# Advisory Fleet Brief — ryanhenderson.dev

**Advisors consulted**:
- Security & Reliability — `claude-sonnet-4-6` (HIGH confidence)
- Simplicity & Alternatives — `claude-sonnet-4-6` (HIGH confidence) *[devil's advocate]*
- Scalability & Performance — `gemini` (HIGH confidence)
- Organizational & Delivery — `gemini` (HIGH confidence)

**Advisors unavailable**: none missed all 4 lenses; codex CLI not installed (Security + Simplicity ran on a single claude call per the fallback table; Scalability + Organizational ran on a single gemini call). All 4 lenses produced valid feedback.

---

## P0 Concerns

None. Two independent advisors gave HIGH confidence; concerns are at P1 and below.

---

## P1 Concerns

### 1. Draft content & preview-deploy exposure (Security)
- **Detail**: E-1 hides drafts in **prod** builds. E-5 spins up CF Pages **preview** builds for non-master branches; preview URLs (`*.pages.dev`) are publicly reachable and crawlable by default. Spec doesn't say preview builds also exclude drafts.
- **Risk**: WIP drafts accidentally published via preview URL; search engines can index `*.pages.dev`.
- **Suggestion**: Apply the *same* draft filter to preview builds, OR enable Cloudflare Access on preview deployments (one-click in CF Pages settings), OR ship a `_headers` file that adds `X-Robots-Tag: noindex` on non-prod branches. Pick one and codify it in the deployment epic.

### 2. CF API token scope (Security)
- **Detail**: U-22 (scripted DNS + Pages provisioning) implies an API token. Default account-level tokens grant access to every zone and project on the account.
- **Risk**: Token leak → DNS takeover or deploy poisoning across all CF assets, not just this site.
- **Suggestion**: Issue a scoped token: `Zone:DNS:Edit` for the `ryanhenderson.dev` zone only + `Account:Cloudflare Pages:Edit` for the single project only. Document the scope in the deployment runbook. Verify the rotation flow in S-13.

### 3. Build-time supply-chain risk (Security)
- **Detail**: Satori, Pagefind, Shiki, and Astro's transitive deps execute arbitrary code during `astro build` and write into `dist/`. A compromised package ships malicious HTML.
- **Risk**: Crypto miner / phishing payload injection via a poisoned dependency.
- **Suggestion**: Commit `pnpm-lock.yaml`, run `pnpm install --frozen-lockfile` in the CF Pages build command, run `pnpm audit` in CI. Cheap and standard.

### 4. RSS draft filter is a contract, not a guarantee (Security)
- **Detail**: U-9 specifies "last 20 non-draft posts." If RSS generation is a separate pass from page rendering, the filter can drift and silently leak drafts to subscribers (worse than HTML — already in their reader before you notice).
- **Suggestion**: One authoritative `getPublishedPosts()` helper used by every artifact (HTML, RSS, sitemap, OG, search index). Build-time smoke test: assert no draft slugs appear in `feed.xml`.

### 5. OG-image generator is the highest-complexity build step (Simplicity + Scalability)
- **Both advisors** flagged this. Claude calls it YAGNI for v1; Gemini calls it a build-time bottleneck that scales linearly with content.
- **Detail**: Satori needs custom font loading, JSX-like rendering, SVG→PNG rasterization, and N output files. Subtle failures (font missing, title truncation) are CI-painful.
- **Risk**: Significant implementation time and ongoing flakiness for a feature only seen when links are shared on social.
- **Suggestion**: **Defer to v1.5.** Ship v1 with proper `og:title` + `og:description` meta tags and one branded static fallback PNG. Cache or generate Satori later when you have evidence anyone is sharing links. The spec currently treats this as a v1 must-have — Gate 2 is the moment to revisit.

### 6. Atom feed is YAGNI alongside RSS 2.0 (Simplicity)
- **Detail**: U-9 specifies both `/feed.xml` and `/atom.xml`. Every modern reader accepts RSS 2.0; `@astrojs/rss` doesn't generate Atom natively, so Atom needs a hand-rolled template.
- **Suggestion**: Drop Atom from v1. Ship RSS 2.0 only. Add Atom on demand if a specific reader requires it.

### 7. Scriptable DNS provisioning is YAGNI for a personal site (Simplicity)
- **Detail**: U-22 requires an idempotent Wrangler/CF API script. The domain is provisioned once and almost never reprovisioned.
- **Risk**: Non-trivial implementation, broader token scope (see #2), and a script that rots unused.
- **Suggestion**: Provision DNS once via the CF dashboard (~5 minutes). Document the records in the repo. Reclaim the effort for content. **This contradicts the user's stated preference** ("plan + script everything") — surface it explicitly at Gate 2.

### 8. Migration link rot (Organizational)
- **Detail**: U-24 covers `/hello-blog/` but not Jekyll's old tag/category URL shapes (`/categories/foo/`, `/tags/foo/`, etc.) that the legacy theme produced.
- **Risk**: External backlinks to legacy taxonomy URLs return 404.
- **Suggestion**: Audit any inbound links to the current site (Search Console; existing analytics) before cutover. Codify a `_redirects` file (CF Pages native) for any legacy paths that can't be preserved 1:1.

### 9. Brutalist-token rabbit hole (Organizational)
- **Detail**: Solo developer building a custom design system from scratch is a known time sink.
- **Risk**: "CSS fatigue" delays content delivery; site never ships.
- **Suggestion**: Time-box the design-system epic. Ship a small, opinionated token set (8–12 tokens covering type stack, scale, spacing rhythm, ink/paper, accent, rule weights) and stop. Iterate via content, not via more tokens.

### 10. Pagefind index payload (Scalability)
- **Detail**: Even with 15 documents, the WASM + index shards consume mobile bandwidth.
- **Suggestion**: Confirm Pagefind is dynamically imported on first interaction (not on initial page load anywhere). Lighthouse-test the search route in mobile profile before claiming U-18 holds.

---

## P2 Concerns

| # | Concern | Source | Tl;dr |
|---|---|---|---|
| 11 | No baseline CSP headers | Security | Cheap to add via `_headers` now; painful to retrofit. Theme inline script needs `'unsafe-inline'` or a nonce. |
| 12 | Preview URLs indexable | Security | Add `X-Robots-Tag: noindex` on non-prod branches, or enable CF Access on previews. |
| 13 | ⌘K overlay vs `/search` page | Simplicity | Ship Pagefind's drop-in UI on a `/search` page; defer ⌘K to v2 unless navigation data shows search is hot. Spec already defers; just lock the v1 choice. |
| 14 | `sitemap-index.xml` naming | Simplicity | Sitemap *index* is for >50k URLs. `@astrojs/sitemap` generates an index regardless; cosmetic — don't over-specify the format. |
| 15 | Two Shiki themes doubles CSS | Simplicity | Use Shiki's `cssVariables` mode driven by design tokens. Or commit to a single high-contrast monochrome theme that fits brutalism. |
| 16 | Image pipeline latency | Scalability | Astro `<Image>` is fine until `dist/` exceeds ~50 MB; revisit only if media-heavy projects appear. |
| 17 | Rigid zod schemas raise friction | Organizational | Make non-essential fields optional in v1 to lower the bar to publish. |

---

## Strengths (consensus across advisors)

- **Static-only with no runtime, no DB, no auth** — every "no" in the Out-of-Scope section is the right call. Near-zero production attack surface; Lighthouse achievability is high.
- **Astro + MDX + Pagefind + CF Pages** is the simplest viable stack for this problem. Stack choice should not be revisited.
- **Separate `blog` and `projects` content collections** (vs. a single collection with a `kind` discriminator) is the correct Astro choice — better type safety and query ergonomics.
- **Cookieless CF Web Analytics + ban on third-party trackers** keeps privacy posture clean and avoids consent-banner overhead.
- **Reversibility & change-volatility section** is unusually thoughtful for a personal-project spec.
- **Vendor consolidation on Cloudflare** (DNS + hosting + analytics) reduces ops surface to a single dashboard.
- **Solo-dev cognitive load is well respected**: no comments, no auth, no i18n, MDX-only authoring.

---

## Alternative Approaches surfaced

1. **Static OG fallback for v1**, defer Satori. (Claude, P1) — Most impactful tradeoff to consider.
2. **CF Access on preview deployments** instead of changing build logic — solves preview-draft exposure with one toggle. (Claude, P1)
3. **Single high-contrast monochrome Shiki theme** instead of dual light/dark — more on-brand for brutalism, halves CSS weight. (Claude, P2)
4. **`/search` page with Pagefind's drop-in UI** instead of custom ⌘K overlay — ship in hours not weeks. (Claude, P2)
5. **Provision DNS via the dashboard once**, drop U-22 — reclaim the scripted-infra effort. (Claude, P1) *(Note: contradicts user's stated preference; needs Gate 2 conversation.)*

---

## Confidence Summary

| Lens | Confidence | Justification |
|---|---|---|
| Security & Reliability | **HIGH** | Static, no functions, no DB, no auth in v1 — attack surface is well-bounded. Remaining concerns are build-pipeline hygiene. |
| Simplicity & Alternatives | **HIGH** | Scope is narrow and well-defined. Over-engineering is isolated to 3 build-time features (Satori, Atom, scripted DNS) rather than systemic. |
| Scalability & Performance | **HIGH** | Stack is natively optimized for static content; ≤15 items is well within Astro's sweet spot. |
| Organizational & Delivery | **HIGH** | Plan is focused; avoids high-maintenance dynamic features; CF vendor alignment reduces ops surface. |

---

## Net recommendation

**Approve the spec for decomposition** with two suggested edits, both of which conflict with v1 features the user already selected and therefore must go to Gate 2:

1. **Demote OG images from v1 must-have to v1.5** (ship static fallback in v1).
2. **Reduce U-22 from "script DNS via Wrangler/CF API" to "provision DNS once via dashboard, document in runbook"** (saves the scoped-token + idempotent-script work).

If both stay in v1, accept the cost is ~one extra epic of effort and the security mitigation in Concern #2 becomes mandatory.

The remaining P1 concerns are all addressable as cross-cutting requirements that the architect should fold into per-epic acceptance criteria (draft-filter unification, frozen-lockfile, `_redirects` audit, time-boxed token system, lazy Pagefind).