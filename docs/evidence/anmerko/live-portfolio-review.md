# Live Anmerko portfolio verification

Verified 2026-09-15 after [rename PR #43](https://github.com/htxryan/ryanhenderson.dev/pull/43) merged with exact reviewed head `38737dffbafcee4311d2479d3087f7a7959e8643` into master `3dd700d12f5397a0bea0d9f0796994343044b70d`.

## Deployment and checks

[Production CI / Pages deployment](https://github.com/htxryan/ryanhenderson.dev/actions/runs/34930694932) passed build, Playwright, Lychee, Lighthouse and Pages deployment. Deployment completed at 2026-09-15T04:58:42.999Z: [f9ddb1c0 deployment](https://f9ddb1c0.ryanhenderson-dev.pages.dev). Dist artifact `10381950384`, digest `sha256:a0c913b3c1b0a53d22555422fdb6c6a06948cb26b8808285b4aae738592b4139`.

PR checks passed after rerunning Lychee against the now-live destination. Local check/build passed; unit tests 240 passed, 125 skipped; production-preview browser tests 26 passed, 8 skipped; Lighthouse nine reports passed assertions. An initial browser run used a previously running dev server; rerunning against the configured production preview resolved its CSP/Pagefind failures.

## Manual live review

Edge CUA visited [work](https://ryanhenderson.dev/work/) and [AI tag](https://ryanhenderson.dev/tags/ai/) at 1280×900 and 390×844 in light and dark themes.

- Work contains exactly three cards: anmerko, Salata Recipe Finder, Menu Simplifier, in that order.
- AI tag contains two entries: exactly one anmerko and Menu Simplifier.
- Anmerko card points to `https://anmerko.com/`, with `target="_blank"` and `rel="noreferrer"`.
- Both layouts fit without horizontal overflow. Theme toggles worked.
- Clicking the card opened the live app. Documentation opened `/docs/`; Help opened `/docs/troubleshooting/`. The destination reports store listings awaiting publication; this review makes no new-store availability claim.
- Browser warning/error logs were empty for portfolio and destination journeys.

| Route | Light | Dark | Narrow light | Narrow dark |
| --- | --- | --- | --- | --- |
| Work | [image](live-work-light.png) | [image](live-work-dark.png) | [image](live-work-narrow-light.png) | [image](live-work-narrow-dark.png) |
| AI tag | [image](live-ai-light.png) | [image](live-ai-dark.png) | [image](live-ai-narrow-light.png) | [image](live-ai-narrow-dark.png) |

Journey: [destination](live-destination.png), [documentation](live-docs.png), [help](live-help.png).

## Generated index metadata

Live HTML was byte-identical to the downloaded production dist artifact for both routes, with zero Briefmark occurrences. Each contains one anmerko card (name and URL account for two textual occurrences).

| Route | Canonical | Description / Open Graph description | HTML SHA-256 |
| --- | --- | --- | --- |
| Work | `https://ryanhenderson.dev/work/` | `Work I'm ... working on` | `65131b82168883b6fd166f8bfb6225a2d677e53b4baa170fe6b414d5ef3080b2` |
| AI tag | `https://ryanhenderson.dev/tags/ai/` | `Posts and projects tagged #ai.` | `f258c95e8c7000ec78fed4ce9109a2bf7eb9c68b0d1d7ded3712aede038779da` |

Both retain `Ryan Henderson` as title / Open Graph title. Original dirty dependency runbook was preserved.
