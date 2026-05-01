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

// Whole-file scan with [\s\S]* lets the regex span newlines so a multi-line
// `getCollection(\n  "blog"\n)` doesn't slip through.
const PATTERN = /getCollection\s*\(\s*["'`](?:blog|projects)["'`]\s*[,)]/g;
// Catch alias re-imports: `import { getCollection as gc }` or
// `export { getCollection } from "astro:content"` outside the helper module.
const ALIAS_PATTERN =
  /(?:import|export)[\s\S]*?\bgetCollection\b[\s\S]*?from\s*["'`]astro:content["'`]/g;

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

function lineOf(text, index) {
  let n = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) n++;
  }
  return n;
}

const offenders = [];
for (const file of walk(SRC)) {
  if (ALLOWED.has(file)) continue;
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(PATTERN)) {
    offenders.push({
      file: relative(ROOT, file),
      lineNo: lineOf(text, m.index ?? 0),
      line: text.slice(m.index ?? 0, (m.index ?? 0) + (m[0]?.length ?? 0)).replace(/\s+/g, " "),
      kind: "call",
    });
  }
  for (const m of text.matchAll(ALIAS_PATTERN)) {
    offenders.push({
      file: relative(ROOT, file),
      lineNo: lineOf(text, m.index ?? 0),
      line: text.slice(m.index ?? 0, (m.index ?? 0) + (m[0]?.length ?? 0)).replace(/\s+/g, " "),
      kind: "import/export",
    });
  }
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
