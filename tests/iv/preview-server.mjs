#!/usr/bin/env node
/**
 * IV — Local preview server that emulates Cloudflare Pages.
 *
 * Reads `dist/_redirects` and `dist/_headers` and applies them to incoming
 * requests, then falls through to static file serving from `dist/`.
 *
 * The CF Pages `_redirects` format we support (sufficient for our rules):
 *   - exact-match source → dest with optional status (default 301).
 *   - Comments (#…) and blank lines ignored.
 *
 * The CF Pages `_headers` format we support:
 *   - `/*` global block — applied to every response.
 *   - `https://:project.pages.dev/*` and similar host-scoped blocks — these
 *     are skipped here because the browser hits 127.0.0.1 in test, not
 *     pages.dev. The vitest deploy.test.ts asserts those statically.
 *
 * Why not `astro preview`? It does not apply `public/_redirects`, and we
 * are testing the legacy-URL behavioural contract C-11. Plus it's simpler
 * to keep the IV server and the static set in lockstep.
 */
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";

const ROOT = resolve(new URL(".", import.meta.url).pathname, "..", "..");
const DIST = join(ROOT, "dist");
const PORT = Number(process.env.PORT ?? 4321);

function parseRedirects(text) {
  const rules = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    const [source, dest, statusStr] = parts;
    rules.push({ source, dest, status: statusStr ? Number(statusStr) : 301 });
  }
  return rules;
}

function parseGlobalHeaders(text) {
  const headers = {};
  const lines = text.split(/\r?\n/);
  let inGlobal = false;
  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    // A new pattern at column 0 ends the prior block.
    if (!line.startsWith(" ") && !line.startsWith("\t")) {
      inGlobal = trimmed === "/*";
      continue;
    }
    if (!inGlobal) continue;
    const colon = trimmed.indexOf(":");
    if (colon < 0) continue;
    const name = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    headers[name] = value;
  }
  return headers;
}

const REDIRECTS = (() => {
  try {
    return parseRedirects(readFileSync(join(DIST, "_redirects"), "utf-8"));
  } catch {
    return [];
  }
})();

const GLOBAL_HEADERS = (() => {
  try {
    return parseGlobalHeaders(readFileSync(join(DIST, "_headers"), "utf-8"));
  } catch {
    return {};
  }
})();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

function tryFile(urlPath) {
  // Strip query string.
  const clean = urlPath.split("?")[0];
  const candidates = [
    join(DIST, clean.replace(/^\//, "")),
    join(DIST, clean.replace(/^\//, ""), "index.html"),
    join(DIST, clean.replace(/^\//, "") + ".html"),
  ];
  for (const c of candidates) {
    // Guard against path traversal (e.g. /../etc/passwd) — `join` normalises
    // `..` segments, so a candidate that escapes DIST is rejected before
    // touching the filesystem. statSync would 404 today, but the guard makes
    // the contract explicit and survives future refactors.
    if (c !== DIST && !c.startsWith(DIST + "/")) continue;
    try {
      const st = statSync(c);
      if (st.isFile()) return c;
    } catch {
      // not found, try next
    }
  }
  return null;
}

function applyHeaders(res) {
  for (const [k, v] of Object.entries(GLOBAL_HEADERS)) {
    res.setHeader(k, v);
  }
}

const server = createServer((req, res) => {
  const url = req.url ?? "/";

  // Match _redirects rules first (CF Pages applies these before static).
  const cleanUrl = url.split("?")[0];
  const rule = REDIRECTS.find((r) => r.source === cleanUrl);
  if (rule) {
    applyHeaders(res);
    res.writeHead(rule.status, { Location: rule.dest });
    res.end();
    return;
  }

  const file = tryFile(url);
  if (!file) {
    // Serve 404.html with status 404.
    const notFound = join(DIST, "404.html");
    try {
      const body = readFileSync(notFound);
      applyHeaders(res);
      res.writeHead(404, { "Content-Type": MIME[".html"] });
      res.end(body);
      return;
    } catch {
      applyHeaders(res);
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }
  }

  const ext = extname(file).toLowerCase();
  const type = MIME[ext] ?? "application/octet-stream";
  applyHeaders(res);
  res.writeHead(200, { "Content-Type": type });
  res.end(readFileSync(file));
});

server.listen(PORT, "127.0.0.1", () => {
  // Emit an explicit readiness line so LHCI's `startServerReadyPattern`
  // ("listening") has something concrete to match against. Playwright
  // doesn't rely on stdout (it polls the URL), so the extra line is
  // harmless there.
  console.log(`[iv-preview] listening on http://127.0.0.1:${PORT}`);
});

// Graceful shutdown on SIGTERM (Playwright sends this).
process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
