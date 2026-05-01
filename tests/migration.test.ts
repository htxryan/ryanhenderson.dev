import { describe, expect, test } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * E8 — Migration & SEO Cutover acceptance tests.
 *
 * Covers (per epic acceptance criteria):
 *   - U-24: /hello-blog/ resolves (canonical or 301 to new slug)
 *   - U-25: about route ports legacy content (verified in site-shell.test.ts)
 *   - C-11: public/_redirects ships at dist/_redirects (CF Pages contract)
 *   - Cross-cutting (STPA B3 / advisory P1 #8): every URL in
 *     `docs/migration/legacy-urls.txt` either renders a 200 in dist/ OR
 *     matches a rule in `public/_redirects`. (Drift between the audit and
 *     the redirects is the failure mode that produces silent link rot.)
 *   - favicon.ico accessible from the build root.
 */

const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist");

function read(file: string): string {
  return readFileSync(file, "utf-8");
}

interface Rule {
  source: string;
  dest: string;
  status: number;
}

function parseRedirects(text: string): Rule[] {
  const rules: Rule[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 3) continue;
    const [source, dest, statusStr] = parts;
    const status = Number(statusStr);
    rules.push({ source, dest, status });
  }
  return rules;
}

interface AuditEntry {
  url: string;
  disposition: "PRESERVE" | "REDIRECT" | "404-OK";
  redirectTarget?: string;
}

function parseAudit(text: string): AuditEntry[] {
  const entries: AuditEntry[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "").trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const m = line.match(/^(\S+)\s+(PRESERVE|REDIRECT|404-OK)(?:\s+(\S+))?\s*$/);
    if (!m) continue;
    const [, url, disposition, redirectTarget] = m;
    entries.push({
      url,
      disposition: disposition as AuditEntry["disposition"],
      redirectTarget,
    });
  }
  return entries;
}

function hasBuiltPath(url: string): boolean {
  // Strip query/fragment, then test for either the file directly or
  // <url>index.html (Astro emits trailing-slash directory style).
  const clean = url.split(/[?#]/)[0];
  const direct = join(DIST, clean.replace(/^\//, ""));
  if (existsSync(direct)) return true;
  if (clean.endsWith("/")) {
    return existsSync(join(direct, "index.html"));
  }
  return false;
}

const REDIRECTS_PATH = join(DIST, "_redirects");
const AUDIT_PATH = join(ROOT, "docs", "migration", "legacy-urls.txt");

describe("C-11 — _redirects ships at dist/_redirects", () => {
  test("file exists in build output", () => {
    expect(existsSync(REDIRECTS_PATH), `expected ${REDIRECTS_PATH}`).toBe(true);
  });

  test("file format: each rule is `<source>  <destination>  <status>`", () => {
    const rules = parseRedirects(read(REDIRECTS_PATH));
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) {
      expect(r.source.startsWith("/")).toBe(true);
      // Destination may be a path or absolute URL; the CF format accepts both.
      expect(r.dest.length).toBeGreaterThan(0);
      // CF Pages supports 200 (rewrite), 301, 302, 303, 307, 308.
      expect([200, 301, 302, 303, 307, 308]).toContain(r.status);
    }
  });
});

describe("U-24 — legacy /hello-blog/ URL is preserved (301 to new canonical)", () => {
  test("a redirect rule covers /hello-blog/ → /posts/hello-blog/", () => {
    const rules = parseRedirects(read(REDIRECTS_PATH));
    const match = rules.find((r) => r.source === "/hello-blog/");
    expect(match, "no rule for /hello-blog/ in _redirects").toBeDefined();
    expect(match?.dest).toBe("/posts/hello-blog/");
    expect(match?.status).toBe(301);
  });

  test("the new canonical /posts/hello-blog/ resolves in the build", () => {
    expect(hasBuiltPath("/posts/hello-blog/")).toBe(true);
  });
});

describe("the-cost-of-estimation draft is in the collection but unbuilt", () => {
  test("draft is excluded from /posts/<slug>/", () => {
    expect(hasBuiltPath("/posts/the-cost-of-estimation/")).toBe(false);
  });
});

describe("favicon.ico accessible from build root", () => {
  test("dist/favicon.ico exists", () => {
    const path = resolve(DIST, "favicon.ico");
    expect(existsSync(path)).toBe(true);
  });
});

describe("CROSS-CUTTING (STPA B3) — every audited legacy URL is covered", () => {
  // Every row in `docs/migration/legacy-urls.txt` must either:
  //   - PRESERVE: render a 200 in dist/ at the same path
  //   - REDIRECT: have a matching rule in public/_redirects whose target
  //     also resolves in dist/
  //   - 404-OK: explicitly accepted as a 404 (no enforcement)
  //
  // Drift between the audit and the redirects is the failure mode the
  // advisory brief (P1 #8) calls out. This test pins the invariant.
  const audit = parseAudit(read(AUDIT_PATH));
  const rules = parseRedirects(read(REDIRECTS_PATH));
  const ruleBySource = new Map(rules.map((r) => [r.source, r]));

  test("audit file is non-empty", () => {
    expect(audit.length).toBeGreaterThan(0);
  });

  test.each(audit.filter((e) => e.disposition === "PRESERVE"))(
    "PRESERVE: %s renders a 200 in dist/",
    (entry) => {
      expect(hasBuiltPath(entry.url)).toBe(true);
    },
  );

  test.each(audit.filter((e) => e.disposition === "REDIRECT"))(
    "REDIRECT: %s has a matching rule in _redirects",
    (entry) => {
      const rule = ruleBySource.get(entry.url);
      expect(rule, `no _redirects rule for ${entry.url}`).toBeDefined();
      // If the audit named a target, the rule must agree.
      if (entry.redirectTarget) {
        expect(rule?.dest).toBe(entry.redirectTarget);
      }
      // The redirect status must be 301 (permanent) — temporary redirects
      // do not consolidate link equity for SEO migrations.
      expect(rule?.status).toBe(301);
    },
  );

  test("every REDIRECT target resolves in dist/ (no broken redirect chains)", () => {
    for (const entry of audit) {
      if (entry.disposition !== "REDIRECT") continue;
      const target = entry.redirectTarget ?? ruleBySource.get(entry.url)?.dest;
      if (!target) continue;
      // Skip absolute URLs (cross-domain redirects) — only assert on local.
      if (target.startsWith("http")) continue;
      expect(
        hasBuiltPath(target),
        `redirect target ${target} (for ${entry.url}) does not resolve in dist/`,
      ).toBe(true);
    }
  });

  test("every _redirects rule traces back to an audit row", () => {
    const auditSources = new Set(audit.map((e) => e.url));
    for (const rule of rules) {
      expect(
        auditSources.has(rule.source),
        `_redirects rule ${rule.source} has no row in legacy-urls.txt`,
      ).toBe(true);
    }
  });
});
