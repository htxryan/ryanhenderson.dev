#!/usr/bin/env node
/**
 * Single-source enforcement for content collection access.
 *
 * Cross-cutting concern (advisory P1 #4 / STPA control-action B1): the
 * filter authority for "what is publishable" is `src/lib/content.ts`. If
 * any other file calls `getCollection("blog")` or `getCollection("projects")`
 * directly, drafts and `status: private` projects can leak into RSS feeds,
 * sitemaps, OG image emitters, search indexes, or tag archives.
 *
 * This script greps for forbidden direct calls outside the helper module
 * and exits non-zero on hits. It is wired into `pnpm build` so the deploy
 * gate enforces it.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const SRC = join(ROOT, "src");
const ALLOWED = new Set([
  resolve(SRC, "lib", "content.ts"),
]);

const SKIP_DIRS = new Set(["node_modules", ".astro", "dist", ".git"]);
const EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".astro"]);

const PATTERN = /getCollection\(\s*["'`](blog|projects)["'`]\s*[,)]/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (st.isFile()) {
      const dot = name.lastIndexOf(".");
      if (dot >= 0 && EXTS.has(name.slice(dot))) yield full;
    }
  }
}

const offenders = [];
for (const file of walk(SRC)) {
  if (ALLOWED.has(file)) continue;
  const text = readFileSync(file, "utf8");
  text.split(/\r?\n/).forEach((line, i) => {
    if (PATTERN.test(line)) {
      offenders.push({ file: relative(ROOT, file), lineNo: i + 1, line: line.trim() });
    }
  });
}

if (offenders.length > 0) {
  console.error(
    "\n[content-source] FAIL: direct getCollection() call outside src/lib/content.ts\n",
  );
  console.error(
    "All publishable-content access MUST flow through src/lib/content.ts",
  );
  console.error("(getPublishedPosts / getPublishedProjects).\n");
  for (const o of offenders) {
    console.error(`  ${o.file}:${o.lineNo}  ${o.line}`);
  }
  console.error(
    "\nWhy: drafts and `status: private` entries must be filtered in exactly\n" +
      "one place. See cross-cutting concern P1 #4 in the decomposition doc.\n",
  );
  process.exit(1);
}

console.log("[content-source] OK — single filter authority preserved.");
