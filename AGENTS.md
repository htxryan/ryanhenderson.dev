# Agent Instructions

This is the canonical instruction file for AI coding agents working on this
project. `CLAUDE.md` intentionally contains only `@AGENTS.md` so all agent
guidance stays in one place.

Run `bd prime` at the start of a session, after compaction, or whenever workflow
context may be stale.

## Quick Commands

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work atomically
bd close <id>         # Complete work
bd dolt push          # Push beads data to remote

pnpm dev             # Local dev server with HMR
pnpm build           # Production build: content checks, tokens, Astro, Pagefind, CSP hashes
pnpm test            # Vitest unit/integration tests
pnpm test:e2e        # Playwright e2e suite
pnpm gen:tokens      # Regenerate src/styles/tokens.css from src/styles/tokens.ts
```

## Environment

- Use Node `>=22.18.0`.
- Use `pnpm@10.33.0`.
- This is an Astro 5 static site deployed as a static build.

## Non-Interactive Shell Commands

Always use non-interactive flags with file operations to avoid hanging on
confirmation prompts. Commands such as `cp`, `mv`, and `rm` may be aliased to
interactive mode on some systems.

```bash
cp -f source dest
mv -f source dest
rm -f file
rm -rf directory
cp -rf source dest
```

Other commands that may prompt:

- `scp`: use `-o BatchMode=yes`
- `ssh`: use `-o BatchMode=yes`
- `apt-get`: use `-y`
- `brew`: use `HOMEBREW_NO_AUTO_UPDATE=1`

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

<!-- compound-agent:start -->
## Compound Agent Integration

This project uses compound-agent for lesson memory. Use the repo-local CLI via
`npx ca` so commands resolve to the package version in this project.

### CLI Commands

```bash
npx ca search "query"       # Search stored lessons
npx ca knowledge "keywords" # Search indexed project docs; use keyword phrases
npx ca learn "insight"      # Capture a verified lesson
npx ca list                 # List stored lessons
npx ca show <id>            # Show a lesson
npx ca wrong <id>           # Mark a lesson incorrect
```

### Mandatory Recall

Call `npx ca search` and `npx ca knowledge` before:

- Architectural decisions or complex planning
- Implementing patterns used before in this repo
- Acting after user corrections such as "actually", "wrong", or "use X instead"

Never edit `.claude/lessons/` or `.claude/lessons/index.jsonl` directly. Use the
CLI so IDs, schema validation, and SQLite sync stay correct.

Before capturing with `npx ca learn`, verify the lesson is novel, specific, and
preferably actionable.
<!-- compound-agent:end -->

## Build & Test

```bash
pnpm build
pnpm test
pnpm exec playwright test tests/iv/scenarios.spec.ts
pnpm gen:tokens
```

`pnpm build` runs:

1. `pnpm check:content-source`
2. `pnpm check:content-slugs`
3. `pnpm gen:tokens`
4. `astro build`
5. `pagefind --site dist`
6. `pnpm check:csp-hashes`

## Running Locally

Always use `pnpm dev` for local preview. It runs `astro dev` on port `4321`
with hot module reload, so content and style edits show up without a manual
restart.

```bash
pkill -f "astro preview|astro dev|preview-server" 2>/dev/null || true
PIDS="$(lsof -ti:4321 -sTCP:LISTEN 2>/dev/null)"
[ -z "$PIDS" ] || kill $PIDS
pnpm dev > /tmp/astro-dev.log 2>&1 &
```

Then point the user at `http://localhost:4321/`.

Do not use `pnpm preview` for iterative review because it serves `dist/` and
requires a full rebuild plus server restart for every change. Reserve preview
mode for final pre-push smoke checks.

There is a known harmless esbuild warning during dev startup about a JSDoc
comment in `src/components/ThemeBoot.astro`; Vite's dependency scanner trips on
a `<meta charset>` token inside the comment. The page still serves, so ignore
that stack trace.

## Architecture Overview

- Astro static site using `output: static` behavior and `trailingSlash:
  "always"` via directory-format builds.
- Design system is brutalist and mono-driven, with tokens in
  `src/styles/tokens.ts` and generated CSS in `src/styles/tokens.css`.
- Light and dark themes are selected with a `data-theme` attribute on `<html>`,
  set before paint by `src/components/ThemeBoot.astro`.
- Routes live in `src/pages/`. Astro excludes files and directories prefixed
  with `_`; this currently hides the blog routes under `src/pages/_blog/` and
  the project detail route at `src/pages/work/_[slug].astro`.
- Content collections live in `src/content/` and must be consumed through
  helpers in `src/lib/content.ts`. `pnpm check:content-source` enforces this
  single filter authority.
- Identity strings such as site name and tagline live in
  `src/lib/site-meta.ts`. Edit there instead of hard-coding them in pages.
- `BLOG_VISIBLE` in `src/lib/content.ts` short-circuits `getPublishedPosts()`
  to `[]` while the blog is hidden.

## Conventions & Patterns

- All external links use `target="_blank"` and `rel="noreferrer"`. Add `me` to
  the `rel` list for identity profiles such as Twitter, LinkedIn, and GitHub.
- Project cards do not use internal detail pages. Titles link directly to the
  marketing site, or to the repository if no marketing site exists.
- After editing `src/styles/tokens.ts`, run `pnpm gen:tokens`; `tests/tokens.test.ts`
  asserts that `tokens.css` matches the generated output.
- WCAG contrast for accent, muted, ink, and rule colors is asserted in
  `tests/tokens.test.ts`. New light and dark accent variants must pass AA
  contrast, 4.5:1, against their respective `paper` colors.
