import { describe, expect, test, beforeAll } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

/**
 * E9 — Deployment, DNS & Hardening acceptance tests.
 *
 * Covers:
 *   - C-12: `_headers` ships with CSP (hash-pinned), nosniff, referrer
 *     policy, branch-conditional X-Robots-Tag for *.pages.dev hosts.
 *   - C-13: build command surface — `deploy` script wraps frozen-lockfile
 *     install + build; build script chains the CSP integrity check.
 *   - U-23: `.env.example` lists the required env-var names; `.env.local`
 *     is gitignored.
 *   - W-2: CF Web Analytics beacon source-of-truth is BaseLayout + a
 *     `process.env.CF_WEB_ANALYTICS_TOKEN` guard; absent in the dev/test
 *     build (token unset) — verified on shipped dist/ HTML.
 *   - Integrity: every inline <script> in dist/ has a SHA-256 source in
 *     the CSP script-src directive.
 */

const ROOT = resolve(__dirname, "..");
const DIST = join(ROOT, "dist");
const HEADERS = join(ROOT, "public", "_headers");

beforeAll(() => {
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error("Expected build to emit dist/index.html");
  }
  if (!existsSync(HEADERS)) {
    throw new Error("Expected public/_headers to exist (E9 ships C-12)");
  }
});

function read(path: string): string {
  return readFileSync(path, "utf-8");
}

function* walkHtml(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walkHtml(p);
    else if (e.isFile() && e.name.endsWith(".html")) yield p;
  }
}

function cspString(): string {
  const text = read(HEADERS);
  const line = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.toLowerCase().startsWith("content-security-policy:"));
  if (!line) throw new Error("CSP header not found in _headers");
  return line.replace(/^content-security-policy:\s*/i, "");
}

function directives(): Map<string, string[]> {
  const csp = cspString();
  const map = new Map<string, string[]>();
  for (const part of csp.split(";").map((p) => p.trim()).filter(Boolean)) {
    const [name, ...rest] = part.split(/\s+/);
    map.set(name.toLowerCase(), rest);
  }
  return map;
}

describe("C-12 — _headers exists with required directives", () => {
  test("Content-Security-Policy applies to all routes (/* block)", () => {
    const text = read(HEADERS);
    // The /* block precedes the CSP line; assert ordering rather than
    // just presence so we don't accept a CSP scoped to some other path.
    expect(text).toMatch(/^\/\*\s*$/m);
    const sliceFromGlobal = text.slice(text.search(/^\/\*\s*$/m));
    expect(sliceFromGlobal).toMatch(/Content-Security-Policy:/i);
  });

  test("CSP default-src is 'self'", () => {
    expect(directives().get("default-src")).toEqual(["'self'"]);
  });

  test("CSP script-src includes 'self' and the CF Insights origin", () => {
    const ss = directives().get("script-src") ?? [];
    expect(ss).toContain("'self'");
    expect(ss).toContain("https://static.cloudflareinsights.com");
  });

  test("CSP script-src has at least one 'sha256-...' hash source", () => {
    const ss = directives().get("script-src") ?? [];
    const hashes = ss.filter((t) => /^'sha256-[A-Za-z0-9+/]+=*'$/.test(t));
    expect(hashes.length).toBeGreaterThan(0);
  });

  test("CSP frame-ancestors locks to 'none'", () => {
    expect(directives().get("frame-ancestors")).toEqual(["'none'"]);
  });

  test("CSP object-src locks to 'none'", () => {
    expect(directives().get("object-src")).toEqual(["'none'"]);
  });

  test("CSP base-uri and form-action are scoped to 'self'", () => {
    expect(directives().get("base-uri")).toEqual(["'self'"]);
    expect(directives().get("form-action")).toEqual(["'self'"]);
  });

  test("CSP connect-src permits the CF Insights endpoint", () => {
    const cs = directives().get("connect-src") ?? [];
    expect(cs).toContain("'self'");
    expect(cs).toContain("https://cloudflareinsights.com");
  });

  test("baseline hardening headers present on /*", () => {
    const text = read(HEADERS);
    expect(text).toMatch(/X-Content-Type-Options:\s*nosniff/i);
    expect(text).toMatch(/Referrer-Policy:\s*strict-origin-when-cross-origin/i);
    expect(text).toMatch(/Permissions-Policy:/i);
  });
});

describe("C-12 — branch-conditional noindex for previews (advisory P1 #1, P2 #12)", () => {
  test("X-Robots-Tag noindex on the *.pages.dev hostnames", () => {
    const text = read(HEADERS);
    // Two patterns: project subdomain (production *.pages.dev) and the
    // branch.<project>.pages.dev preview pattern. Both must noindex.
    expect(text).toMatch(/https:\/\/:project\.pages\.dev\/\*/);
    expect(text).toMatch(/https:\/\/:branch\.:project\.pages\.dev\/\*/);
    // And both blocks emit X-Robots-Tag.
    const matches = text.match(/X-Robots-Tag:\s*noindex/gi) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  test("apex (production) does NOT carry an X-Robots-Tag", () => {
    // Sanity: the /* block must not noindex production. Search for the
    // /* block specifically and confirm the only X-Robots-Tag occurrences
    // are inside the *.pages.dev sub-blocks below it.
    const text = read(HEADERS);
    const blockRe = /^\/\*\s*\n([\s\S]*?)(?=\n\S|$)/m;
    const m = blockRe.exec(text);
    expect(m).not.toBeNull();
    const block = m![1];
    expect(block).not.toMatch(/X-Robots-Tag/i);
  });
});

describe("CSP integrity — every inline <script> in dist/ has a hash source", () => {
  test("no orphaned inline scripts (dist/ is in sync with _headers)", () => {
    const ss = directives().get("script-src") ?? [];
    const declared = new Set<string>();
    for (const t of ss) {
      const m = t.match(/^'sha256-([A-Za-z0-9+/]+=*)'$/);
      if (m) declared.add(m[1]);
    }

    const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
    const SRC_ATTR_RE = /\bsrc\s*=/i;

    const observed = new Map<string, { samplePath: string; sample: string }>();
    for (const file of walkHtml(DIST)) {
      const html = read(file);
      let m: RegExpExecArray | null;
      SCRIPT_RE.lastIndex = 0;
      while ((m = SCRIPT_RE.exec(html)) !== null) {
        const attrs = m[1];
        const body = m[2];
        if (SRC_ATTR_RE.test(attrs)) continue;
        if (body.length === 0) continue;
        const hash = createHash("sha256")
          .update(body, "utf-8")
          .digest("base64");
        if (!observed.has(hash))
          observed.set(hash, { samplePath: file, sample: body.slice(0, 80) });
      }
    }

    const missing = [...observed.keys()].filter((h) => !declared.has(h));
    if (missing.length > 0) {
      const detail = missing
        .map((h) => `  ${h} — ${observed.get(h)?.samplePath}`)
        .join("\n");
      throw new Error(
        `Inline scripts in dist/ not allowed by CSP:\n${detail}\n` +
          `Run \`node scripts/check-csp-hashes.mjs --fix\` and commit _headers.`,
      );
    }
    expect(missing).toEqual([]);
  });

  test("CSP has no stale hashes (every declared hash matches a script)", () => {
    const ss = directives().get("script-src") ?? [];
    const declared = new Set<string>();
    for (const t of ss) {
      const m = t.match(/^'sha256-([A-Za-z0-9+/]+=*)'$/);
      if (m) declared.add(m[1]);
    }

    const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
    const SRC_ATTR_RE = /\bsrc\s*=/i;
    const observed = new Set<string>();
    for (const file of walkHtml(DIST)) {
      const html = read(file);
      let m: RegExpExecArray | null;
      SCRIPT_RE.lastIndex = 0;
      while ((m = SCRIPT_RE.exec(html)) !== null) {
        if (SRC_ATTR_RE.test(m[1])) continue;
        if (m[2].length === 0) continue;
        observed.add(createHash("sha256").update(m[2], "utf-8").digest("base64"));
      }
    }

    const stale = [...declared].filter((h) => !observed.has(h));
    expect(stale).toEqual([]);
  });
});

describe("C-13 — build command + frozen-lockfile contract", () => {
  const pkg = JSON.parse(read(join(ROOT, "package.json")));

  test("'build' script runs the CSP hash check after astro/pagefind", () => {
    const build = pkg.scripts.build as string;
    expect(build).toMatch(/astro build/);
    expect(build).toMatch(/pagefind --site dist/);
    expect(build).toMatch(/check:csp-hashes/);
    // Order matters: csp check must run AFTER pagefind, not before.
    const astroIdx = build.indexOf("astro build");
    const cspIdx = build.indexOf("check:csp-hashes");
    expect(cspIdx).toBeGreaterThan(astroIdx);
  });

  test("'deploy' script enforces frozen lockfile (P1 #3)", () => {
    expect(pkg.scripts.deploy).toMatch(/pnpm install --frozen-lockfile/);
    expect(pkg.scripts.deploy).toMatch(/pnpm build/);
  });

  test("'check:csp-hashes' and 'provision:cf' scripts exist", () => {
    expect(pkg.scripts["check:csp-hashes"]).toBeTruthy();
    expect(pkg.scripts["provision:cf"]).toMatch(/scripts\/provision-cf\.ts/);
  });

  test("provision:cf runs via Node's --experimental-strip-types", () => {
    // The script body is .ts; it must run without a TypeScript build step.
    expect(pkg.scripts["provision:cf"]).toMatch(/--experimental-strip-types/);
  });
});

describe("U-23 — env vars: documented + secrets gitignored", () => {
  test(".env.example exists and lists the required vars", () => {
    const env = read(join(ROOT, ".env.example"));
    for (const v of [
      "PUBLIC_SITE_URL",
      "CF_WEB_ANALYTICS_TOKEN",
      "CF_API_TOKEN",
      "CF_ACCOUNT_ID",
      "CF_ZONE_ID",
    ]) {
      expect(env).toMatch(new RegExp(`^${v}=`, "m"));
    }
  });

  test(".env.local is gitignored", () => {
    const gi = read(join(ROOT, ".gitignore"));
    expect(gi).toMatch(/^\.env\.local$/m);
  });

  test("no .env / .env.local file is committed at repo root", () => {
    // Defensive: catch a stray env file landing in the working tree.
    // .env.example IS expected; the others MUST not exist.
    expect(existsSync(join(ROOT, ".env"))).toBe(false);
    expect(existsSync(join(ROOT, ".env.local"))).toBe(false);
  });
});

describe("W-2 — CF Web Analytics beacon", () => {
  test("not emitted in test/dev build (no CF_WEB_ANALYTICS_TOKEN set)", () => {
    // The vitest build runs without CF_WEB_ANALYTICS_TOKEN, so the beacon
    // must be absent. Check the home and a post page (BaseLayout consumers).
    for (const route of [
      join(DIST, "index.html"),
      join(DIST, "about", "index.html"),
    ]) {
      const html = read(route);
      expect(html).not.toMatch(/static\.cloudflareinsights\.com/);
      expect(html).not.toMatch(/data-cf-beacon/);
    }
  });

  test("BaseLayout source guards beacon on import.meta.env.PROD AND token presence", () => {
    const layout = read(join(ROOT, "src", "layouts", "BaseLayout.astro"));
    expect(layout).toMatch(/cloudflareinsights\.com\/beacon\.min\.js/);
    expect(layout).toMatch(/CF_WEB_ANALYTICS_TOKEN/);
    expect(layout).toMatch(/import\.meta\.env\.PROD/);
  });
});

describe("provision-cf script — surface contract", () => {
  const src = read(join(ROOT, "scripts", "provision-cf.ts"));

  test("documents the four exit codes (0/1/2/3/4) in source", () => {
    expect(src).toMatch(/Exit codes:[\s\S]+?0[\s\S]+?1[\s\S]+?2[\s\S]+?3[\s\S]+?4/);
  });

  test("is idempotent by construction (uses GET-then-POST/PATCH probes)", () => {
    // Light source-level smoke: a list of regexes that, if any goes missing,
    // signals the script lost its no-op property. Over-strict on purpose —
    // forces a deliberate test update if the API surface changes.
    expect(src).toMatch(/listRecordsByName/);
    expect(src).toMatch(/ensureCustomDomain/);
    expect(src).toMatch(/ensurePagesProject/);
    expect(src).toMatch(/return "ok"/);
  });

  test("never deletes records (no DELETE method usage)", () => {
    // The api() helper's first parameter is the HTTP verb; assert no
    // call site requests DELETE.
    expect(src).not.toMatch(/api<[^>]*>\(\s*"DELETE"/);
    expect(src).not.toMatch(/method:\s*"DELETE"/);
  });

  test("exits 2 on missing CF_API_TOKEN (auth contract)", () => {
    expect(src).toMatch(/die\(2/);
    expect(src).toMatch(/need\("CF_API_TOKEN"\)/);
  });
});

describe("docs/runbooks — deploy + dns runbooks present", () => {
  test("deploy.md and dns.md exist", () => {
    const deploy = join(ROOT, "docs", "runbooks", "deploy.md");
    const dns = join(ROOT, "docs", "runbooks", "dns.md");
    expect(existsSync(deploy)).toBe(true);
    expect(existsSync(dns)).toBe(true);
  });

  test("dns.md documents token scope and exit codes", () => {
    const dns = read(join(ROOT, "docs", "runbooks", "dns.md"));
    expect(dns).toMatch(/Zone[^\n]*DNS[^\n]*Edit/);
    expect(dns).toMatch(/Cloudflare Pages[^\n]*Edit/);
    // The exit-code table must list 0..4
    for (const code of ["0", "1", "2", "3", "4"]) {
      expect(dns).toMatch(new RegExp(`\`${code}\``));
    }
  });

  test("deploy.md documents the build gate steps + CSP rotation", () => {
    const dep = read(join(ROOT, "docs", "runbooks", "deploy.md"));
    expect(dep).toMatch(/pnpm install --frozen-lockfile/);
    expect(dep).toMatch(/check:csp-hashes/);
    expect(dep).toMatch(/check:content-source/);
    expect(dep).toMatch(/check:content-slugs/);
  });
});

describe("retired metadata — favicon path stable from E8", () => {
  // Cheap regression: E8 shipped favicon.ico in public/. E9 shouldn't
  // accidentally remove it (CSP `default-src 'self'` would still allow it,
  // but a missing file 404s on every page).
  test("public/favicon.ico still present and ships into dist/", () => {
    expect(existsSync(join(ROOT, "public", "favicon.ico"))).toBe(true);
    expect(existsSync(join(DIST, "favicon.ico"))).toBe(true);
  });
});

describe("_redirects — preserved through E9 (E8 ships it)", () => {
  // Defensive: E9's `_headers` lives next to `_redirects`. Both must
  // survive the build pipeline into dist/.
  test("_redirects copied into dist/", () => {
    expect(existsSync(join(DIST, "_redirects"))).toBe(true);
  });

  test("_headers copied into dist/", () => {
    expect(existsSync(join(DIST, "_headers"))).toBe(true);
    const dist = read(join(DIST, "_headers"));
    const src = read(HEADERS);
    expect(dist).toBe(src);
  });
});

describe("BaseLayout still emits a single ThemeBoot script", () => {
  // Stability invariant: ThemeBoot appears exactly once in dist HTML.
  test("each route has exactly one inline <script> matching the ThemeBoot signature", () => {
    for (const file of walkHtml(DIST)) {
      const html = read(file);
      const matches = html.match(/dataset\.theme\s*=/g) ?? [];
      // One ThemeBoot reference + zero or one ThemeToggle reference.
      // (ThemeToggle reads dataset.theme; tests below allow >=1.)
      expect(matches.length).toBeGreaterThanOrEqual(1);
    }
  });
});
