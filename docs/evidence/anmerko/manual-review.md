# anmerko portfolio preparation: manual browser review

Source: `78002397d38e3a684d7008201c1daf56b975470d`.
Pull request: [htxryan/ryanhenderson.dev#43](https://github.com/htxryan/ryanhenderson.dev/pull/43).
Date: 15 September 2026 UTC.
Preview: the dedicated worktree's `pnpm dev` server at `http://127.0.0.1:4321`.

Reviewed interactively using the Codex in-app browser, separately from the
automated Playwright suite:

- `/work/` shows three cards and exactly one lowercase **anmerko** entry.
- Its heading links to `https://anmerko.com/`, with `target="_blank"` and
  `rel="noreferrer"`. No private repository link appears on the card.
- `/tags/ai/` shows anmerko and Menu Simplifier, matching the existing tags.
- Switched the theme through the visible toggle and inspected the desktop
  light and dark results at 1280 px width.
- Inspected both pages at 390 × 844. Text wraps, the theme toggle works, and
  the work page's document width equals its 390 px viewport without horizontal
  overflow. Restored the viewport override afterward.
- Browser console inspection returned no warning or error entries. Separate
  HTTP checks returned 200 for both pages and every local script/stylesheet
  referenced by their rendered HTML (11 assets per page).

Screenshots:

- [Work, light](work-light.png)
- [Work, dark](work-dark.png)
- [Work, narrow dark](work-narrow-dark.png)
- [AI tag, narrow light](ai-narrow-light.png)

The new public app origin has not been provisioned yet. The outbound journey
and live portfolio deployment remain unverified and gate merging this change.
This review does not complete issue #76's T39 or its cross-site acceptance.
