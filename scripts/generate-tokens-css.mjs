#!/usr/bin/env node
/**
 * Generate `src/styles/tokens.css` from `src/styles/tokens.ts`.
 *
 * tokens.ts is the single source of truth (consumed by Satori in E7). This
 * script produces the static CSS file that Astro layouts import. Run it
 * whenever tokens.ts changes:
 *
 *   pnpm gen:tokens
 *
 * The corresponding test (`tests/tokens.test.ts`) asserts the file on disk
 * matches what this script would write — so a forgotten regeneration fails
 * CI.
 *
 * Node 22.6+ runs `.ts` files via type-stripping when imported under a
 * `.mjs` script. This project's local Node is 24+, which supports it
 * stably; on older runtimes the `pnpm build` test gate catches drift even
 * if regeneration fails.
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const cssPath = resolve(repoRoot, "src/styles/tokens.css");

const { tokensToCss } = await import("../src/styles/tokens.ts");
const out = tokensToCss();
writeFileSync(cssPath, out);
console.log(`[gen:tokens] wrote ${cssPath} (${out.length} bytes)`);
