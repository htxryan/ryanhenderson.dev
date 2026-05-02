import { afterEach, describe, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Integration test for scripts/check-content-helpers.mjs.
 *
 * The script enforces that getCollection("blog"|"projects") is only called
 * inside src/lib/content.ts. A regression in the regex (e.g. line-by-line
 * scan, no alias detection) would silently let drafts leak into RSS feeds.
 * These tests pin the script's behavior on representative offenders.
 */

const SCRIPT = resolve(__dirname, "..", "scripts", "check-content-helpers.mjs");

let scratch: string | null = null;

afterEach(() => {
  if (scratch) {
    rmSync(scratch, { recursive: true, force: true });
    scratch = null;
  }
});

function makeRepo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "e1-check-"));
  scratch = root;
  mkdirSync(join(root, "src", "lib"), { recursive: true });
  // Always provide an allowed helper so the ALLOWED set has something to match.
  writeFileSync(
    join(root, "src", "lib", "content.ts"),
    `import { getCollection } from "astro:content";\nexport const x = getCollection("blog");\n`,
  );
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(resolve(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

function run(cwd: string): { rc: number; out: string } {
  try {
    const out = execFileSync(process.execPath, [SCRIPT], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { rc: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout?: string; stderr?: string };
    return { rc: err.status ?? 1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

describe("scripts/check-content-helpers.mjs", () => {
  test("passes when only the allowed helper module calls getCollection", () => {
    const root = makeRepo({});
    const r = run(root);
    expect(r.rc).toBe(0);
  });

  test("fails on a single-line offender outside src/lib/content.ts", () => {
    const root = makeRepo({
      "src/pages/index.astro": `---
import { getCollection } from "astro:content";
const posts = getCollection("blog");
---
`,
    });
    const r = run(root);
    expect(r.rc).toBe(1);
    expect(r.out).toMatch(/single filter authority|FAIL/);
  });

  test("fails on a multi-line getCollection call (would defeat a per-line scan)", () => {
    const root = makeRepo({
      "src/lib/feed.ts": `import { getCollection } from "astro:content";
const posts = getCollection(
  "blog"
);
`,
    });
    const r = run(root);
    expect(r.rc).toBe(1);
    expect(r.out).toMatch(/FAIL/);
  });

  test("fails on aliased import (`getCollection as gc`)", () => {
    const root = makeRepo({
      "src/lib/feed.ts": `import { getCollection as gc } from "astro:content";
export const posts = gc("blog");
`,
    });
    const r = run(root);
    // The regex catches the import/export form even when the call uses an alias.
    expect(r.rc).toBe(1);
  });

  test("ignores unrelated getCollection-named function in user code", () => {
    const root = makeRepo({
      "src/lib/util.ts": `function getCollection() { return []; }
export const x = getCollection();
`,
    });
    // No string arg "blog"|"projects" and no astro:content import — must pass.
    const r = run(root);
    expect(r.rc).toBe(0);
  });
});
