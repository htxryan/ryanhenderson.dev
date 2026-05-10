---
title: Deploy runbook — ryanhenderson.dev
epic: E9
contracts:
- C-12
- C-13
ears:
- U-21
- U-23
- E-4
- E-5
permalink: ryanhenderson.dev/runbooks/deploy
---

# Deploy runbook

Operational reference for `ryanhenderson.dev`. Read this before changing
the build pipeline, the CF Pages project, or anything in `public/_headers`.

## Stack

| Concern | Tool |
|---|---|
| Source-of-truth | GitHub repo (`master` branch deploys to prod) |
| Hosting | Cloudflare Pages — project `ryanhenderson-dev` |
| Domain | `ryanhenderson.dev` (apex) + `www.ryanhenderson.dev` |
| Analytics | Cloudflare Web Analytics (cookieless beacon) |
| DNS | Cloudflare (same account as Pages) |

The deploy gate is the build itself. CF Pages does not run a separate CI
step; if `pnpm build` exits non-zero, nothing is published.

## CF Pages project settings

These values must match the dashboard (Pages → `ryanhenderson-dev` →
Settings → Builds & deployments). The script `scripts/provision-cf.ts`
binds custom domains and DNS records but does NOT create the project — do
that once in the dashboard, then run the script.

| Field | Value |
|---|---|
| Production branch | `master` |
| Build command | `pnpm install --frozen-lockfile && pnpm build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Node version | `>=22.18.0` (matches `package.json#engines`) |
| Package manager | pnpm 10.x (set via `package.json#packageManager`) |

## Build gate (C-13)

`pnpm build` is composed of these steps; each MUST pass:

1. `pnpm check:content-source` — single filter authority for `getCollection()`.
2. `pnpm check:content-slugs` — slug uniqueness + lowercase-kebab discipline.
3. `pnpm gen:tokens` — emits `src/styles/_tokens.generated.css` from the TS token module.
4. `astro build` — zod-validates frontmatter, renders MDX + Shiki, generates OG images, emits RSS / sitemap / robots.txt.
5. `pagefind --site dist` — builds the static search index.
6. `pnpm check:csp-hashes` — verifies every inline `<script>` in `dist/` has a SHA-256 hash listed in `public/_headers`.

A failure in any step fails the whole build, fails the deploy, and leaves
the previous production deploy serving traffic.

### Frozen lockfile (advisory P1 #3)

CF Pages MUST run `pnpm install --frozen-lockfile`. This is the supply-chain
mitigation: a lockfile drift causes the install (and therefore the build)
to fail rather than silently pulling unreviewed transitive versions. The
lockfile is committed to the repo.

If you change a dependency:

```bash
pnpm install <pkg>
git add package.json pnpm-lock.yaml
git commit -m "deps: update <pkg>"
```

Never edit the lockfile by hand.

## Environment variables

Source: `.env.example` (always up to date). Local: `.env.local` (gitignored,
NEVER commit). Production / preview: set in the CF Pages dashboard
(Settings → Environment variables).

Required for production builds:

| Variable | Used by | Notes |
|---|---|---|
| `PUBLIC_SITE_URL` | Optional convenience for scripts | `astro.config.mjs#site` is canonical. |
| `CF_WEB_ANALYTICS_TOKEN` | `BaseLayout.astro` | Beacon token; missing → no beacon emitted. Designed to ship in HTML. |

Required ONLY for `pnpm provision:cf` (operator workstation, never CI):

| Variable | Notes |
|---|---|
| `CF_API_TOKEN` | Scoped — see `dns.md`. |
| `CF_ACCOUNT_ID` | CF dashboard → right sidebar. |
| `CF_ZONE_ID` | CF dashboard → `ryanhenderson.dev` zone overview. |

Provided by CF Pages at build time (do not set):

- `CF_PAGES_BRANCH`, `CF_PAGES_URL`, `CF_PAGES_COMMIT_SHA`.

## Branch deploys (E-4, E-5)

- **`master`** → production deploy → `ryanhenderson.dev`.
- **Any other branch** → preview deploy at `<branch>.ryanhenderson-dev.pages.dev`.

Preview deploys ARE publicly reachable. The `public/_headers` rule for
`https://:branch.:project.pages.dev/*` adds `X-Robots-Tag: noindex,
nofollow`, so search engines should not index them. Treat preview URLs as
"share-by-link only"; do not paste them into anywhere indexable.

## Headers (C-12)

`public/_headers` ships with every deploy. Two concerns live there:

1. Baseline hardening for every response: CSP, `X-Content-Type-Options:
   nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
   `Permissions-Policy` denying every powerful API we don't use.
2. Branch-conditional `X-Robots-Tag: noindex, nofollow` on the
   `*.pages.dev` hostnames (preview safety).

The CSP `script-src` is hash-pinned. Whenever an inline `<script>` body
changes — `ThemeBoot.astro`, the `ThemeToggle` bundled output, or the
search-page lazy-load IIFE — the build-time check (`pnpm check:csp-hashes`)
will fail until the hash list is regenerated:

```bash
pnpm build                           # fails with a precise diff
node scripts/check-csp-hashes.mjs --fix
git diff public/_headers             # review the change
git commit -am "csp: update inline-script hashes (<reason>)"
```

NEVER run `--fix` automatically in CI; the failure IS the alert.

## Deploys

Normal flow:

```bash
git push origin master    # → CF Pages webhook → build → deploy
```

Watch the build at: CF dashboard → Pages → `ryanhenderson-dev` →
Deployments. A typical successful build is under 90 seconds.

### Rollback

CF Pages keeps every deploy. To revert:

1. Dashboard → `ryanhenderson-dev` → Deployments.
2. Find the last known-good deploy (label / commit SHA).
3. Click ⋯ → "Rollback to this deployment".

This re-aliases the production hostname; no rebuild required. Then fix
the offending commit on `master` and push (the dashboard rollback is
displaced by the next push to `master`).

### Manual deploy

Avoid. The deploy gate lives in the build script; running `wrangler pages
deploy dist` from a workstation bypasses zod validation, the slug check,
and the CSP integrity check. If you must:

```bash
pnpm install --frozen-lockfile && pnpm build
pnpm dlx wrangler@latest pages deploy dist --project-name ryanhenderson-dev
```

…and file a beads issue to figure out why CI was bypassed.

## Smoke checks after a release

Hit each in a private window:

- `https://ryanhenderson.dev/` — home, both themes, no FOUC.
- `https://ryanhenderson.dev/feed.xml` — XML, current posts.
- `https://ryanhenderson.dev/sitemap-index.xml` — non-empty.
- `https://ryanhenderson.dev/posts/hello-blog/` — legacy redirect resolves.
- DevTools → Network → headers — confirm `Content-Security-Policy`,
  `X-Content-Type-Options`, `Referrer-Policy` present; no
  `X-Robots-Tag` on the apex.

CF Web Analytics surfaces traffic ~1–2 minutes after first hit (Dashboard
→ Analytics & Logs → Web Analytics).

## Related

- `docs/runbooks/dns.md` — token scopes and DNS provisioning.
- `docs/specs/blog-portfolio-site.md` §4.7 — EARS for hosting.
- `docs/specs/blog-portfolio-site-decomposition.md` E9 row — epic scope.