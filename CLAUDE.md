# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->


## Build & Test

```bash
pnpm dev          # local dev server with HMR — see "Running locally" below
pnpm build        # full production build (content checks + tokens + astro + pagefind + CSP hashes)
pnpm test         # vitest run
pnpm exec playwright test tests/iv/scenarios.spec.ts   # e2e (CI also runs this)
pnpm gen:tokens   # regenerate src/styles/tokens.css from src/styles/tokens.ts
```

## Running locally

**Always use `pnpm dev` for local preview.** It runs `astro dev` on port 4321
with hot module reload, so content + style edits show up in the browser
without a manual restart.

```bash
pkill -f "astro preview|astro dev|preview-server" 2>/dev/null
lsof -ti:4321 -sTCP:LISTEN | xargs -r kill 2>/dev/null
pnpm dev > /tmp/astro-dev.log 2>&1 &
```

Then point the user at `http://localhost:4321/`.

**Do NOT use `pnpm preview` for iterative review** — it serves the built
`dist/` and requires a full rebuild + server restart for every change. Reserve
preview-mode for the final pre-push smoke check.

There is a known harmless esbuild warning during dev startup about a JSDoc
comment in `src/components/ThemeBoot.astro` (vite's dependency scanner trips
on a `<meta charset>` token inside the comment). The page still serves —
ignore the stack trace.

## Architecture Overview

Astro static site (v5, `output: static`, `trailingSlash: "always"`). Brutalist
mono-driven design system with a single set of tokens in
`src/styles/tokens.ts` → generated `tokens.css`. Light + dark theme via a
`data-theme` attribute on `<html>` set pre-paint by an inline boot script.

- Routes live in `src/pages/`. Files/dirs prefixed with `_` are excluded
  from the build by Astro — currently used to hide the blog
  (`src/pages/_blog/`) and the project detail route
  (`src/pages/work/_[slug].astro`).
- Content collections in `src/content/` (`blog`, `projects`) loaded via
  `astro:content` and consumed exclusively through helpers in
  `src/lib/content.ts` (single filter authority — enforced by
  `pnpm check:content-source`).
- Identity strings (site name, tagline) live in `src/lib/site-meta.ts` —
  edit there to update titles + meta descriptions everywhere.
- `BLOG_VISIBLE` flag in `src/lib/content.ts` short-circuits
  `getPublishedPosts()` to `[]` while the blog is hidden.

## Conventions & Patterns

- All external links use `target="_blank"` and `rel="noreferrer"` (add
  `me` to the rel list for identity profiles like Twitter/LinkedIn/GitHub).
- Project cards show no internal detail page — title links straight to the
  marketing site (or repo if no marketing site).
- Tagline + name come from `src/lib/site-meta.ts`. Don't hard-code them in
  pages.
- After editing `src/styles/tokens.ts`, always run `pnpm gen:tokens` —
  there's a `tests/tokens.test.ts` round-trip assertion that fails if
  `tokens.css` drifts.
- WCAG: every accent/muted/ink/rule color is contrast-asserted in
  `tests/tokens.test.ts`. Picking a new accent? Both light and dark
  variants must pass AA (4.5:1) against their respective `paper`.
