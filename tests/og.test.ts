import { describe, expect, test, beforeAll } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

/**
 * E7 — OG Image Pipeline acceptance tests.
 *
 * Acceptance criteria from ryanhenderson.dev-x6q:
 *   - every published post gets `/og/<slug>.png` and meta tags pointing at it
 *   - every visible (non-private) project gets `/og/<slug>.png` and meta tags
 *   - fallback `og-default.png` exists at the site root
 *   - og:title, og:description, og:image
 *     present on post + project routes
 *   - drafts and private projects produce no OG card
 *
 * The site build runs once via Vitest's globalSetup
 * (vitest.config.ts → tests/setup/build.ts).
 */

const DIST = resolve(__dirname, "..", "dist");

beforeAll(() => {
  if (!existsSync(DIST)) {
    throw new Error("Expected the global build hook to have produced dist/");
  }
});

function read(relative: string): string {
  return readFileSync(resolve(DIST, relative), "utf-8");
}

function isPng(path: string): boolean {
  // PNG magic bytes: 0x89 P N G \r \n 0x1a \n
  const buf = readFileSync(path);
  return (
    buf.length > 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  );
}

describe("E7 — fallback og-default.png", () => {
  test("exists at the site root and is a valid PNG", () => {
    const path = resolve(DIST, "og-default.png");
    expect(existsSync(path), "expected dist/og-default.png").toBe(true);
    expect(isPng(path)).toBe(true);
  });

  test("has non-trivial size (> 1KB) — sanity check it is not a stub", () => {
    const path = resolve(DIST, "og-default.png");
    expect(statSync(path).size).toBeGreaterThan(1024);
  });
});

// SKIP: blog hidden — no post pages, no per-post OG cards. Restore via
// BLOG_VISIBLE in src/lib/content.ts and src/pages/_blog/.
describe.skip("E7 — per-post OG cards (acceptance criterion #1)", () => {
  // Authored posts in this repo after E8 cutover.
  const publishedPostSlugs = [
    "hello-world",
    "early-post",
    "mid-post",
    "hello-blog",
  ] as const;

  for (const slug of publishedPostSlugs) {
    test(`/og/${slug}.png exists and is a valid PNG`, () => {
      const path = resolve(DIST, "og", `${slug}.png`);
      expect(existsSync(path), `expected dist/og/${slug}.png`).toBe(true);
      expect(isPng(path)).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(1024);
    });

    test(`/posts/${slug}/ meta points at /og/${slug}.png`, () => {
      const html = read(`posts/${slug}/index.html`);
      const expected = `https://ryanhenderson.dev/og/${slug}.png`;
      expect(html).toContain(`property="og:image" content="${expected}"`);
    });
  }
});

// SKIP: project detail pages were removed (titles link to marketing/repo
// directly). Per-project OG cards have no consumer; OG endpoint now
// returns []. Restore this block + the og endpoint enumeration when
// /work/<slug>/ pages return.
describe.skip("E7 — per-project OG cards (acceptance criterion #2)", () => {
  // Visible (non-private) projects.
  const publishedProjectSlugs = ["alpha", "bravo", "charlie"] as const;

  for (const slug of publishedProjectSlugs) {
    test(`/og/${slug}.png exists and is a valid PNG`, () => {
      const path = resolve(DIST, "og", `${slug}.png`);
      expect(existsSync(path), `expected dist/og/${slug}.png`).toBe(true);
      expect(isPng(path)).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(1024);
    });

    test(`/work/${slug}/ meta points at /og/${slug}.png`, () => {
      const html = read(`work/${slug}/index.html`);
      const expected = `https://ryanhenderson.dev/og/${slug}.png`;
      expect(html).toContain(`property="og:image" content="${expected}"`);
    });
  }
});

describe("E7 — drafts and private projects produce no OG card (single filter authority)", () => {
  test("draft post 'draft-fixture' has no /og/draft-fixture.png", () => {
    expect(existsSync(resolve(DIST, "og", "draft-fixture.png"))).toBe(false);
  });

  test("draft post 'the-cost-of-estimation' has no /og/the-cost-of-estimation.png", () => {
    expect(
      existsSync(resolve(DIST, "og", "the-cost-of-estimation.png")),
    ).toBe(false);
  });

  test("private project 'delta' has no /og/delta.png", () => {
    expect(existsSync(resolve(DIST, "og", "delta.png"))).toBe(false);
  });
});

// SKIP: post pages and project detail pages are both currently absent
// (blog hidden + work detail removed). The shell-route OG checks below
// still cover home/about/404 via og-default.png.
describe.skip("E7 — meta tag completeness (acceptance criterion #5)", () => {
  const routes = [
    { kind: "post", path: "posts/hello-world/index.html" },
    { kind: "project", path: "work/alpha/index.html" },
  ] as const;

  for (const { kind, path } of routes) {
    describe(kind, () => {
      const html = () => read(path);

      test("declares og:title", () => {
        expect(html()).toMatch(/property="og:title"/);
      });
      test("declares og:description", () => {
        expect(html()).toMatch(/property="og:description"/);
      });
      test("declares og:image", () => {
        expect(html()).toMatch(/property="og:image"/);
      });
      test("declares og:image:width=1200 and og:image:height=630", () => {
        expect(html()).toContain('property="og:image:width" content="1200"');
        expect(html()).toContain('property="og:image:height" content="630"');
      });
    });
  }
});

describe("E7 — non-article shell routes use the static fallback card", () => {
  // Home, about, 404 don't get a per-slug card; they should reference
  // og-default.png so social previews still render the brutalist mark.
  const shellPaths = [
    "index.html",
    "about/index.html",
    "404.html",
  ] as const;

  for (const path of shellPaths) {
    test(`${path} → og:image = /og-default.png`, () => {
      const html = read(path);
      expect(html).toContain(
        'property="og:image" content="https://ryanhenderson.dev/og-default.png"',
      );
      expect(html).not.toMatch(/twitter/i);
    });
  }
});

describe("E7 — token-drift guard (no parallel hex source)", () => {
  // Implicit contract: the OG template must read tokens from
  // src/styles/tokens.ts (the single source of truth). It must NOT
  // hard-code hex values that could drift from the design system.
  test("scripts/og/template.ts imports from src/styles/tokens.ts", () => {
    const src = readFileSync(
      resolve(__dirname, "..", "scripts/og/template.ts"),
      "utf-8",
    );
    // Must import tokens from the shared module.
    expect(src).toMatch(/from\s+["'][^"']*styles\/tokens(?:\.ts)?["']/);
    // Must not contain bare hex literals (the brutalist palette is in
    // tokens.ts; literals in the template would shadow it). We carve out
    // the file's docstring as a no-op since hex strings could appear in
    // commentary; the practical guard is "no #abcdef as a value".
    const noStringComments = src.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(noStringComments).not.toMatch(/["']#[0-9a-fA-F]{6}["']/);
  });
});
