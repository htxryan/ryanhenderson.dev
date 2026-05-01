import { describe, expect, test, beforeAll } from "vitest";
import { gzipSync } from "node:zlib";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * E3 — Site Shell acceptance tests.
 *
 * Covers:
 *   - U-20: First-load HTML <50KB gzipped on home, about, 404
 *   - U-25 (partial): about route ports legacy content without semantic loss
 *   - C-6: BaseLayout composition contract (canonical, og:title, viewport,
 *     ThemeBoot, skip-link)
 *   - W-1: no external JS bundles loaded on home/about/404 (only inlined
 *     theme scripts)
 *   - 404 uses BaseLayout (theme survives error routes) and is noindex
 *   - Skip-link present and targets #main
 */

const DIST = resolve(__dirname, "..", "dist");

function paths() {
  return {
    home: resolve(DIST, "index.html"),
    about: resolve(DIST, "about", "index.html"),
    notFound: resolve(DIST, "404.html"),
  };
}

// The full build is run once via Vitest's globalSetup
// (see vitest.config.ts → tests/setup/build.ts). Individual suites assert
// against the already-built dist/ artifacts.
beforeAll(() => {
  const p = paths();
  if (!existsSync(p.home) || !existsSync(p.about) || !existsSync(p.notFound)) {
    throw new Error("Expected build to emit home, about, and 404.html");
  }
});

function read(file: string): string {
  return readFileSync(file, "utf-8");
}

function gzipBytes(s: string): number {
  return gzipSync(Buffer.from(s, "utf-8")).length;
}

describe("U-20 — first-load HTML budget", () => {
  test("home is <50KB gzipped", () => {
    expect(gzipBytes(read(paths().home))).toBeLessThan(50_000);
  });
  test("about is <50KB gzipped", () => {
    expect(gzipBytes(read(paths().about))).toBeLessThan(50_000);
  });
  test("404 is <50KB gzipped", () => {
    expect(gzipBytes(read(paths().notFound))).toBeLessThan(50_000);
  });
});

describe("C-6 — BaseLayout composition", () => {
  const allRoutes = ["home", "about", "notFound"] as const;

  test.each(allRoutes)("%s renders charset + viewport + theme boot in head", (key) => {
    const html = read(paths()[key]);
    expect(html).toMatch(/<meta charset="utf-8">/i);
    expect(html).toMatch(/<meta name="viewport"/i);
    // ThemeBoot inline script signature — sets dataset.theme
    expect(html).toMatch(/dataset\.theme/);
  });

  test.each(["home", "about"] as const)("%s emits canonical link", (key) => {
    const html = read(paths()[key]);
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/ryanhenderson\.dev\//);
  });

  test("404 omits canonical (noindex routes must not advertise themselves)", () => {
    const html = read(paths().notFound);
    expect(html).not.toMatch(/rel="canonical"/);
  });

  test.each(allRoutes)("%s emits og:title and og:description", (key) => {
    const html = read(paths()[key]);
    expect(html).toMatch(/property="og:title"/);
    expect(html).toMatch(/property="og:description"/);
  });

  test.each(allRoutes)("%s starts the body with a skip-link to #main", (key) => {
    const html = read(paths()[key]);
    expect(html).toMatch(/<a[^>]*class="skip-link"[^>]*href="#main"[^>]*>/);
    expect(html).toMatch(/<main[^>]*id="main"/);
  });

  test.each(allRoutes)("%s includes the global header with ThemeToggle", (key) => {
    const html = read(paths()[key]);
    expect(html).toMatch(/data-theme-toggle/);
    expect(html).toMatch(/<header[^>]*role="banner"/);
  });

  test.each(allRoutes)("%s includes the global footer", (key) => {
    const html = read(paths()[key]);
    expect(html).toMatch(/<footer[^>]*role="contentinfo"/);
  });
});

describe("W-1 — no extra client JS on shell routes", () => {
  // The theme system ships two scripts: the inline boot in <head> and the
  // toggle's inlined <script type="module">. No external <script src=…>
  // bundles should appear on these routes.
  test.each(["home", "about", "notFound"] as const)(
    "%s has no external <script src=…> bundle",
    (key) => {
      const html = read(paths()[key]);
      expect(html).not.toMatch(/<script[^>]+src=["'][^"']+["']/);
    },
  );
});

describe("404 — error route reuses BaseLayout and is noindex", () => {
  test("uses BaseLayout (header + footer present)", () => {
    const html = read(paths().notFound);
    expect(html).toMatch(/<header[^>]*role="banner"/);
    expect(html).toMatch(/<footer[^>]*role="contentinfo"/);
  });
  test("emits robots noindex meta", () => {
    const html = read(paths().notFound);
    expect(html).toMatch(/<meta name="robots" content="noindex">/);
  });
  test("contains a 404 indicator and recovery links", () => {
    const html = read(paths().notFound);
    expect(html).toMatch(/404/);
    // Recovery exits include /, /work/, /about/. (/posts/ is gated behind
    // BLOG_VISIBLE and currently not built.)
    expect(html).toMatch(/href="\/"/);
    expect(html).toMatch(/href="\/work\/"/);
    expect(html).toMatch(/href="\/about\/"/);
  });
});

describe("about page — bio + outbound profile links", () => {
  // The legacy verbatim port (U-25) was retired when the blog was hidden;
  // the about page was rewritten as a standalone bio. The two contracts the
  // page must still satisfy are: (1) it identifies the author and place,
  // (2) it links out to the canonical profile destinations.
  test("identifies Ryan Henderson and Houston, TX", () => {
    const html = read(paths().about);
    expect(html).toMatch(/Ryan Henderson/);
    expect(html).toMatch(/Houston, Texas/);
  });

  test("preserves both outbound profile links", () => {
    const html = read(paths().about);
    expect(html).toMatch(/href="https:\/\/twitter\.com\/htxryan"/);
    expect(html).toMatch(/href="https:\/\/www\.linkedin\.com\/in\/htxryan/);
  });
});

describe("home composition", () => {
  test("renders the Featured work heading", () => {
    const html = read(paths().home);
    // Recent writing column is gated behind BLOG_VISIBLE; only Featured
    // work renders while the blog is hidden.
    expect(html).toMatch(/Featured work/);
  });

  test("renders the wordmark and primary nav links", () => {
    const html = read(paths().home);
    expect(html).toMatch(/ryanhenderson\.dev/);
    // /posts/ link is gated behind BLOG_VISIBLE; restore when the blog
    // returns.
    expect(html).toMatch(/href="\/work\/"/);
    expect(html).toMatch(/href="\/about\/"/);
  });

  test("nav marks the home link as aria-current=page (attribute-order independent)", () => {
    const html = read(paths().home);
    // Find a nav <a> tag whose href is "/" and whose attribute set includes
    // aria-current="page". Use DOTALL flag so we match across attribute breaks.
    const matches = html.match(/<a\b[^>]*>/g) ?? [];
    const homeAnchors = matches.filter(
      (tag) =>
        /href="\/"/.test(tag) && /aria-current="page"/.test(tag),
    );
    expect(homeAnchors.length).toBeGreaterThanOrEqual(1);
  });
});

describe("baseline a11y/SEO", () => {
  const allRoutes = ["home", "about", "notFound"] as const;

  test.each(allRoutes)("%s declares lang=en on <html> (WCAG 3.1.1)", (key) => {
    const html = read(paths()[key]);
    expect(html).toMatch(/<html\b[^>]*\blang="en"/);
  });

  test.each(allRoutes)("%s emits a non-empty <title>", (key) => {
    const html = read(paths()[key]);
    const m = html.match(/<title>([^<]*)<\/title>/);
    expect(m).not.toBeNull();
    expect((m?.[1] ?? "").trim().length).toBeGreaterThan(0);
  });

  test("404 wraps recovery exits in a <nav> landmark", () => {
    const html = read(paths().notFound);
    expect(html).toMatch(/<nav[^>]*aria-label="Page not found[^"]*"/);
  });

  test.each(allRoutes)("%s emits og:type", (key) => {
    const html = read(paths()[key]);
    expect(html).toMatch(/property="og:type"/);
  });
});

describe("home empty-state markup", () => {
  // The home page tolerates 0 projects without throwing — assert either a
  // ProjectCard list or the empty-state string is present in the work
  // column. (The Recent writing column is gated behind BLOG_VISIBLE;
  // restore the recent-list assertion when the blog returns.)
  test("home has a card list or an empty-state in the work column", () => {
    const html = read(paths().home);
    const hasWorkList = /aria-labelledby="work-heading"[\s\S]*?<ul class="cards"|aria-labelledby="work-heading"[\s\S]*?No projects yet\./.test(html);
    expect(hasWorkList).toBe(true);
  });
});
