import { describe, expect, test } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * IV — Scenario S-15: "Jekyll retired".
 *
 * The retirement-cutover commit (E8) deleted every `_*` file the Jekyll
 * site ran on. This test pins the invariant — if anyone re-introduces a
 * Jekyll-style directory at the repo root (e.g. by reverting a migration
 * commit) the IV gate fails before it can ship.
 *
 * Per spec §6 S-15 and the E8 acceptance criteria.
 */

const ROOT = resolve(__dirname, "..");

// `_site/` is intentionally omitted: it's gitignored, so a contributor
// experimenting locally with Jekyll would fail this gate even though no
// commit could re-introduce the directory. The remaining entries are all
// trackable artefacts whose presence at HEAD would indicate a regression.
const JEKYLL_REMNANTS = [
  "_config.yml",
  "_config.yaml",
  "_posts",
  "_drafts",
  "_data",
  "_layouts",
  "_includes",
  "_sass",
  "Gemfile",
  "Gemfile.lock",
  ".jekyll-metadata",
];

describe("IV — S-15: Jekyll retired (no _* artefacts at repo root)", () => {
  for (const rel of JEKYLL_REMNANTS) {
    test(`${rel} is absent from the repo root`, () => {
      expect(existsSync(resolve(ROOT, rel)), `${rel} reappeared`).toBe(false);
    });
  }
});
