#!/usr/bin/env node
/**
 * E9 — Build-time CSP hash integrity check.
 *
 * Walks `dist/`, collects every inline `<script>...</script>` body, and
 * computes a base64 SHA-256 over the script body bytes (the spec hashes
 * the bytes between the opening `>` and closing `</script>`, not the tag
 * or any attributes — see CSP3 §6.6.4.1).
 *
 * Then loads `public/_headers`, parses the `script-src` directive on the
 * `/*` block, and asserts that:
 *   - every hash observed in dist/ is listed in script-src;
 *   - no hash listed in script-src is unused.
 *
 * Exits non-zero with a precise diff on drift, so the deploy is gated.
 *
 * Usage:
 *   node scripts/check-csp-hashes.mjs           # verify
 *   node scripts/check-csp-hashes.mjs --fix     # rewrite _headers in place
 *
 * --fix should be invoked manually after a deliberate inline-script change
 * (e.g. ThemeBoot edit). Never wire it into CI; the gate's job is to fail.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const DIST = join(ROOT, "dist");
const HEADERS = join(ROOT, "public", "_headers");
const FIX = process.argv.includes("--fix");

function* walkHtml(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      yield* walkHtml(p);
    } else if (e.isFile() && e.name.endsWith(".html")) {
      yield p;
    }
  }
}

// Match <script ...>BODY</script>. The non-greedy [\s\S]*? body is allowed to
// span newlines. We intentionally exclude self-closing or src-bearing tags
// further down — only inline scripts (those with a body) need a hash.
const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
const SRC_ATTR_RE = /\bsrc\s*=/i;

function sha256b64(s) {
  return createHash("sha256").update(s, "utf-8").digest("base64");
}

function collectInlineHashes() {
  // Map<hash, { count: number, samplePath: string, sampleBody: string }>
  const seen = new Map();
  let dirExists = false;
  try {
    dirExists = statSync(DIST).isDirectory();
  } catch {
    dirExists = false;
  }
  if (!dirExists) {
    console.error(
      "[check-csp-hashes] FAIL: dist/ does not exist. Run `pnpm build` first.",
    );
    process.exit(1);
  }
  for (const file of walkHtml(DIST)) {
    const html = readFileSync(file, "utf-8");
    let m;
    SCRIPT_RE.lastIndex = 0;
    while ((m = SCRIPT_RE.exec(html)) !== null) {
      const attrs = m[1];
      const body = m[2];
      // Skip <script src="..."></script> (external, hash-irrelevant).
      if (SRC_ATTR_RE.test(attrs)) continue;
      // Empty body: nothing to hash, nothing to allow.
      if (body.length === 0) continue;
      const hash = sha256b64(body);
      if (!seen.has(hash)) {
        seen.set(hash, {
          count: 0,
          samplePath: relative(ROOT, file),
          sampleBody: body,
        });
      }
      seen.get(hash).count += 1;
    }
  }
  return seen;
}

function loadHeaders() {
  const raw = readFileSync(HEADERS, "utf-8");
  return raw;
}

// Parse `script-src` from the `/*` block. We look for the `Content-Security-Policy`
// header line indented under the global pattern and extract the script-src
// directive's source list.
function extractScriptSrcSources(headersText) {
  const cspLine = headersText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.toLowerCase().startsWith("content-security-policy:"));
  if (!cspLine) {
    throw new Error(
      "_headers does not contain a Content-Security-Policy header on the /* block",
    );
  }
  const csp = cspLine.replace(/^content-security-policy:\s*/i, "");
  const directives = csp.split(";").map((d) => d.trim()).filter(Boolean);
  const scriptSrc = directives.find((d) => d.toLowerCase().startsWith("script-src "));
  if (!scriptSrc) {
    throw new Error("_headers CSP has no script-src directive");
  }
  // Drop the directive name; remaining tokens are sources.
  return scriptSrc.split(/\s+/).slice(1);
}

function isHashSource(token) {
  return /^'sha256-[A-Za-z0-9+/]+=*'$/.test(token);
}

function rewriteScriptSrc(headersText, newHashes) {
  // Preserve the order of non-hash sources; replace existing hash sources
  // with `newHashes` in stable (sorted) order. This keeps diffs minimal and
  // deterministic.
  const lines = headersText.split(/\r?\n/);
  const idx = lines.findIndex((l) =>
    /^\s*content-security-policy\s*:/i.test(l),
  );
  if (idx === -1) throw new Error("CSP line not found while applying --fix");
  const cspLine = lines[idx];
  const leadingMatch = cspLine.match(/^(\s*)/);
  const leading = leadingMatch ? leadingMatch[1] : "";
  const body = cspLine.replace(/^\s*content-security-policy\s*:\s*/i, "");
  const directives = body.split(";").map((d) => d.trim());
  const next = directives.map((d) => {
    if (!d.toLowerCase().startsWith("script-src ")) return d;
    const tokens = d.split(/\s+/);
    const head = tokens[0]; // 'script-src'
    const keep = tokens.slice(1).filter((t) => !isHashSource(t));
    const sortedHashes = [...newHashes].sort().map((h) => `'sha256-${h}'`);
    return [head, ...keep, ...sortedHashes].join(" ");
  });
  lines[idx] = `${leading}Content-Security-Policy: ${next.join("; ")}`;
  return lines.join("\n");
}

function main() {
  const observed = collectInlineHashes();
  const headersText = loadHeaders();
  const sources = extractScriptSrcSources(headersText);
  const declared = new Set();
  for (const s of sources) {
    if (isHashSource(s)) {
      const m = s.match(/^'sha256-([A-Za-z0-9+/]+=*)'$/);
      if (m) declared.add(m[1]);
    }
  }

  const observedSet = new Set(observed.keys());
  const missing = [...observedSet].filter((h) => !declared.has(h));
  const stale = [...declared].filter((h) => !observedSet.has(h));

  if (missing.length === 0 && stale.length === 0) {
    console.log(
      `[check-csp-hashes] OK — ${observedSet.size} inline-script hash${observedSet.size === 1 ? "" : "es"} match _headers.`,
    );
    return;
  }

  if (FIX) {
    const next = rewriteScriptSrc(headersText, observedSet);
    writeFileSync(HEADERS, next);
    console.log(
      `[check-csp-hashes] FIXED — wrote ${observedSet.size} hash${observedSet.size === 1 ? "" : "es"} to public/_headers.`,
    );
    if (missing.length > 0) {
      console.log("  added:");
      for (const h of missing) {
        const info = observed.get(h);
        console.log(`    'sha256-${h}'  (first seen in ${info.samplePath})`);
      }
    }
    if (stale.length > 0) {
      console.log("  removed (no longer present in dist/):");
      for (const h of stale) console.log(`    'sha256-${h}'`);
    }
    return;
  }

  console.error("[check-csp-hashes] FAIL: CSP script-src is out of sync with dist/.\n");
  if (missing.length > 0) {
    console.error("  Inline scripts in dist/ not allowed by CSP (would be blocked):");
    for (const h of missing) {
      const info = observed.get(h);
      const preview = info.sampleBody
        .replace(/^\s+/, "")
        .slice(0, 80)
        .replace(/\n/g, "\\n");
      console.error(`    'sha256-${h}'  ×${info.count}`);
      console.error(`       first: ${info.samplePath}`);
      console.error(`       body : ${preview}…`);
    }
  }
  if (stale.length > 0) {
    console.error("\n  Hashes in _headers no longer present in dist/ (stale):");
    for (const h of stale) console.error(`    'sha256-${h}'`);
  }
  console.error(
    "\nIf you intentionally changed an inline script, regenerate the hash list:\n" +
      "  node scripts/check-csp-hashes.mjs --fix\n" +
      "Then commit public/_headers alongside the script change.\n",
  );
  process.exit(1);
}

main();
