#!/usr/bin/env node
/**
 * Slug discipline for content collections.
 *
 * Per E1 contract C-1:
 *   - slug = filename minus `.mdx`, must match /^[a-z0-9-]+$/
 *   - uniqueness within collection (filesystem path differences are NOT
 *     allowed to disambiguate two files with the same slug)
 *
 * Astro's glob loader derives id from the relative path, so
 * `posts/foo.mdx` and `archive/foo.mdx` would coexist with distinct ids
 * but identical slugs — that's a downstream URL collision waiting to
 * happen. This script catches it pre-build.
 */
import { readdirSync, statSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const COLLECTIONS = ["blog", "projects"];
const SLUG_RE = /^[a-z0-9-]+$/;

function* walkMdx(dir) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      yield* walkMdx(full);
    } else if (st.isFile() && extname(name) === ".mdx") {
      yield full;
    }
  }
}

let badSlug = 0;
let collision = 0;

for (const collection of COLLECTIONS) {
  const dir = join(ROOT, "src", "content", collection);
  let files = [];
  try {
    files = [...walkMdx(dir)];
  } catch {
    continue;
  }

  const bySlug = new Map();
  for (const file of files) {
    const slug = basename(file, ".mdx");
    if (!SLUG_RE.test(slug)) {
      console.error(
        `[content-slugs] FAIL: ${relative(ROOT, file)} — slug "${slug}" does not match /^[a-z0-9-]+$/`,
      );
      badSlug++;
    }
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push(file);
  }
  for (const [slug, group] of bySlug) {
    if (group.length > 1) {
      console.error(
        `[content-slugs] FAIL: collection "${collection}" has duplicate slug "${slug}":`,
      );
      for (const f of group) console.error(`  - ${relative(ROOT, f)}`);
      collision++;
    }
  }
}

if (badSlug > 0 || collision > 0) {
  console.error(
    `\n[content-slugs] ${badSlug} bad slug(s), ${collision} collision(s).\n`,
  );
  process.exit(1);
}

console.log("[content-slugs] OK — slug pattern + uniqueness preserved.");
