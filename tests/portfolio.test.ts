import { describe, expect, test } from "vitest";
import { gzipSync } from "node:zlib";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * E5 — Portfolio Surface acceptance tests.
 *
 * Covers (per epic acceptance criteria):
 *   - U-7: `/work/` lists active first, then archived; private hidden
 *   - U-8: `/work/<slug>/` renders detail with name, oneLiner, status badge,
 *          marketing link, conditional repo link, tags, body
 *   - E-3: project with no `repoUrl` renders zero broken/placeholder repo UI
 *   - <ProjectCard> reused on home and `/work/` index without divergence
 *   - C-6: BaseLayout composition still applies on all portfolio routes
 *   - W-1: no external <script src=…> bundles on portfolio routes
 *   - U-20: portfolio HTML <50KB gzipped
 */

const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist");

function read(file: string): string {
  return readFileSync(file, "utf-8");
}

function gzipBytes(s: string): number {
  return gzipSync(Buffer.from(s, "utf-8")).length;
}

function listProjectHtml(): string[] {
  const dir = join(DIST, "work");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((entry) => {
      const p = join(dir, entry);
      try {
        return statSync(p).isDirectory();
      } catch {
        return false;
      }
    })
    .map((slug) => join(dir, slug, "index.html"))
    .filter((p) => existsSync(p));
}

const WORK_INDEX = join(DIST, "work", "index.html");
const HOME = join(DIST, "index.html");

// Fixtures (alpha/bravo/charlie) were removed; the visible portfolio is
// now butverify, c3p, pearl — all active, all have a repoUrl. Delta
// (private) remains as the hidden-projects fixture. Project detail pages
// were also removed (titles now link straight to the marketing site), so
// many of the U-8/E-3/etc. assertions below are skipped — see notes.
const PUBLISHED_SLUGS = ["butverify", "c3p", "pearl"] as const;
const HIDDEN_SLUG = "delta";

describe("/work/ index — basic shape", () => {
  test("work index page exists", () => {
    expect(existsSync(WORK_INDEX)).toBe(true);
  });

  test("page uses BaseLayout chrome (header, footer, canonical)", () => {
    const html = read(WORK_INDEX);
    expect(html).toMatch(/<header[^>]*role="banner"/);
    expect(html).toMatch(/<footer[^>]*role="contentinfo"/);
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/ryanhenderson\.dev\/work\/"/);
  });

  test("nav marks /work/ as current page", () => {
    const html = read(WORK_INDEX);
    const navAnchors = (html.match(/<a\b[^>]*>/g) ?? []).filter(
      (tag) => /href="\/work\/"/.test(tag) && /aria-current="page"/.test(tag),
    );
    expect(navAnchors.length).toBeGreaterThanOrEqual(1);
  });

  test("emits a heading and an active/archived count", () => {
    const html = read(WORK_INDEX);
    expect(html).toMatch(/<h1[^>]*>All work<\/h1>/);
    expect(html).toMatch(/active/);
    expect(html).toMatch(/archived/);
  });
});

describe("U-7 — status-aware ordering and private hiding", () => {
  test.skip("active projects appear before archived in source order", () => {
    // SKIP: archived-fixture (charlie) was removed; the visible portfolio
    // is all-active. Restore when an archived project ships.
  });

  test("active ties broken alphabetically by id (butverify, c3p, pearl)", () => {
    const html = read(WORK_INDEX);
    // Identify card order by the project title text rather than internal
    // hrefs (titles link out to marketing sites now). Display names:
    // ButVerify, C3P, Pearl. Ordering is by id (slug), not display name —
    // ids are butverify < c3p < pearl alphabetically.
    const idxButverify = html.indexOf(">ButVerify ↗</a>");
    const idxC3p = html.indexOf(">C3P ↗</a>");
    const idxPearl = html.indexOf(">Pearl ↗</a>");
    expect(idxButverify).toBeGreaterThan(-1);
    expect(idxC3p).toBeGreaterThan(-1);
    expect(idxPearl).toBeGreaterThan(-1);
    expect(idxButverify).toBeLessThan(idxC3p);
    expect(idxC3p).toBeLessThan(idxPearl);
  });

  test("private project (delta) has no marketing-link presence on /work/ index", () => {
    const html = read(WORK_INDEX);
    // The schema permits private projects to omit marketingUrl; even if
    // they had one, getPublishedProjects() filters them out before render.
    // Assert no card carries delta's name.
    expect(html).not.toMatch(/>Delta /);
    // And no link points at any common delta domain shape we control.
    expect(html).not.toMatch(/href="\/work\/delta\//);
  });

  test.skip("private project has no rendered detail page", () => {
    // SKIP: detail pages removed for ALL projects, not just private ones.
    // Restore when /work/<slug>/ pages return.
  });

  test("private project (delta) does not appear on the home page either", () => {
    const html = read(HOME);
    expect(html).not.toMatch(/>Delta /);
    expect(html).not.toMatch(/href="\/work\/delta\//);
  });
});

// SKIP: project detail pages removed — titles on cards link directly to
// the project's marketing site (or repo if no marketing site). Restore
// this entire describe when /work/<slug>/ pages return; the file at
// src/pages/work/_[slug].astro still holds the route source.
describe.skip("U-8 — project detail page renders the contracted chrome", () => {
  test("each published project has /work/<slug>/index.html", () => {
    for (const slug of PUBLISHED_SLUGS) {
      const file = join(DIST, "work", slug, "index.html");
      expect(existsSync(file), `expected ${file}`).toBe(true);
    }
  });

  test("detail page renders the name as <h1>", () => {
    for (const slug of PUBLISHED_SLUGS) {
      const html = read(join(DIST, "work", slug, "index.html"));
      expect(html).toMatch(/<h1[^>]*class="project-title"[^>]*>[^<]+<\/h1>/);
    }
  });

  test("detail page renders the oneLiner", () => {
    const html = read(join(DIST, "work", "alpha", "index.html"));
    // Substring drawn from the alpha fixture frontmatter
    expect(html).toMatch(/Active project fixture — has a public repo/);
  });

  test("detail page renders a status badge", () => {
    const alpha = read(join(DIST, "work", "alpha", "index.html"));
    const charlie = read(join(DIST, "work", "charlie", "index.html"));
    expect(alpha).toMatch(/<span[^>]*class="status-badge"[^>]*data-status="active"[^>]*>active<\/span>/);
    expect(charlie).toMatch(/<span[^>]*class="status-badge"[^>]*data-status="archived"[^>]*>archived<\/span>/);
  });

  test("detail page wraps body in <article> so the prose measure applies", () => {
    for (const slug of PUBLISHED_SLUGS) {
      const html = read(join(DIST, "work", slug, "index.html"));
      expect(html).toMatch(/<article[^>]*class="[^"]*\bproject\b[^"]*\bprose\b/);
    }
  });

  test("detail page emits og:type=article (project is an article-type route)", () => {
    for (const slug of PUBLISHED_SLUGS) {
      const html = read(join(DIST, "work", slug, "index.html"));
      expect(html).toMatch(/property="og:type" content="article"/);
    }
  });

  test("detail page emits canonical link to /work/<slug>/", () => {
    for (const slug of PUBLISHED_SLUGS) {
      const html = read(join(DIST, "work", slug, "index.html"));
      expect(html).toMatch(
        new RegExp(`<link rel="canonical" href="https://ryanhenderson\\.dev/work/${slug}/"`),
      );
    }
  });

  test("detail page renders MDX body content", () => {
    // Alpha body contains "What it is" h2 and "What I learned" h2.
    const html = read(join(DIST, "work", "alpha", "index.html"));
    expect(html).toMatch(/<h2[^>]*>\s*What it is\s*<\/h2>/);
    expect(html).toMatch(/<h2[^>]*>\s*What I learned\s*<\/h2>/);
  });
});

function repoTagsIn(html: string): string[] {
  return (html.match(/<a\b[^>]*>/g) ?? []).filter((t) =>
    /\bdata-repo-link\b/.test(t),
  );
}

// SKIP: every visible project (butverify/c3p/pearl) has a repoUrl, so
// the "no repoUrl → no repo UI" contract has no fixture to exercise. The
// markup-level guard still lives in ProjectCard.astro (`showRepoButton`).
// Restore when a future project ships without a repoUrl, or re-add the
// bravo-style fixture.
describe.skip("E-3 — conditional repo link", () => {
  test("project WITH repoUrl renders a repo button on the detail page", () => {
    const html = read(join(DIST, "work", "alpha", "index.html"));
    const tags = repoTagsIn(html);
    expect(tags.length).toBeGreaterThanOrEqual(1);
    expect(tags[0]).toMatch(/href="https:\/\/github\.com\/htxryan\/alpha"/);
  });

  test("project WITHOUT repoUrl renders ZERO repo UI on the detail page", () => {
    const html = read(join(DIST, "work", "bravo", "index.html"));
    // No repo button, no placeholder, nothing carrying the data-repo-link hook.
    expect(html).not.toMatch(/data-repo-link/);
    // Sanity: marketing button still present.
    expect(html).toMatch(/href="https:\/\/bravo\.example"/);
  });

  test("project WITHOUT repoUrl renders ZERO repo UI on the index card", () => {
    const html = read(WORK_INDEX);
    // Walk just the bravo card region by anchoring on its detail link.
    const bravoCardMatch = html.match(
      /<article[^>]*class="project-card"[^>]*>(?:(?!<\/article>)[\s\S])*?href="\/work\/bravo\/"[\s\S]*?<\/article>/,
    );
    expect(bravoCardMatch, "expected to find a bravo card region").not.toBeNull();
    expect(bravoCardMatch?.[0] ?? "").not.toMatch(/data-repo-link/);
    expect(bravoCardMatch?.[0] ?? "").toMatch(/href="https:\/\/bravo\.example"/);
  });

  test("project WITH repoUrl renders a repo button on the index card", () => {
    const html = read(WORK_INDEX);
    const alphaCardMatch = html.match(
      /<article[^>]*class="project-card"[^>]*>(?:(?!<\/article>)[\s\S])*?href="\/work\/alpha\/"[\s\S]*?<\/article>/,
    );
    expect(alphaCardMatch, "expected to find an alpha card region").not.toBeNull();
    expect(alphaCardMatch?.[0] ?? "").toMatch(/data-repo-link/);
    expect(alphaCardMatch?.[0] ?? "").toMatch(/href="https:\/\/github\.com\/htxryan\/alpha"/);
  });
});

describe("ProjectCard — reused on home and /work/ index without divergence", () => {
  test("home page renders ProjectCard markup for featured work", () => {
    const html = read(HOME);
    expect(html).toMatch(/<article[^>]*class="project-card"/);
    // butverify and c3p are both active and appear among the featured set.
    // Card titles link out to marketing sites now — assert by external href.
    expect(html).toMatch(/href="https:\/\/butverify\.dev"/);
    expect(html).toMatch(/href="https:\/\/getc3p\.dev"/);
  });

  test("/work/ index renders the same ProjectCard markup", () => {
    const html = read(WORK_INDEX);
    expect(html).toMatch(/<article[^>]*class="project-card"/);
  });

  test("ProjectCard markup is structurally identical across both routes", () => {
    const home = read(HOME);
    const index = read(WORK_INDEX);
    // Anchor on the butverify card region (its marketing URL is unique).
    // Title now links externally; the comparison shifts from internal
    // /work/<slug>/ href to the marketing href.
    const cardOn = (html: string) =>
      html.match(
        /<article[^>]*class="project-card"[^>]*>(?:(?!<\/article>)[\s\S])*?href="https:\/\/butverify\.dev"[\s\S]*?<\/article>/,
      )?.[0] ?? "";
    const homeCard = cardOn(home);
    const indexCard = cardOn(index);
    expect(homeCard).not.toBe("");
    expect(indexCard).not.toBe("");
    for (const region of [homeCard, indexCard]) {
      expect(region).toMatch(/class="project-card-status"[^>]*data-status="active"/);
      expect(region).toMatch(/class="project-card-title"/);
      expect(region).toMatch(/class="project-card-oneliner"/);
      // butverify has a separate repo URL → secondary repo button renders.
      expect(region).toMatch(/data-repo-link/);
      expect(region).toMatch(/href="https:\/\/github\.com\/htxryan\/butverify"/);
    }
  });
});

describe("outbound links use rel=noreferrer + target=_blank", () => {
  function tagsContaining(html: string, predicate: RegExp): string[] {
    return (html.match(/<a\b[^>]*>/g) ?? []).filter((t) => predicate.test(t));
  }

  test.skip("marketing link on detail page", () => {
    // SKIP: detail pages removed.
  });
  test.skip("repo link on detail page", () => {
    // SKIP: detail pages removed.
  });

  test("title link on a card opens external in a new tab", () => {
    const html = read(WORK_INDEX);
    // Card title is now the primary outbound link.
    const matches = tagsContaining(html, /class="project-card-title"/);
    // The above matches the <h3>; we want the <a> inside it. Walk a tighter
    // pattern instead.
    const titleAnchors = (
      html.match(
        /<h3 class="project-card-title"[^>]*>\s*<a\b[^>]*>/g,
      ) ?? []
    );
    expect(titleAnchors.length, `found 0 title anchors; matches: ${matches.length}`).toBeGreaterThanOrEqual(1);
    for (const tag of titleAnchors) {
      expect(tag).toMatch(/href="https:\/\//);
      expect(tag).toMatch(/target="_blank"/);
      expect(tag).toMatch(/rel="noreferrer"/);
    }
  });

  test("repo link on a card opens external in a new tab", () => {
    const html = read(WORK_INDEX);
    const tags = (html.match(/<a\b[^>]*>/g) ?? []).filter((t) =>
      /\bdata-repo-link\b/.test(t),
    );
    expect(tags.length).toBeGreaterThanOrEqual(1);
    for (const tag of tags) {
      expect(tag).toMatch(/href="https:\/\//);
      expect(tag).toMatch(/target="_blank"/);
      expect(tag).toMatch(/rel="noreferrer"/);
    }
  });
});

// SKIP: detail pages removed. Card-level tag rendering is exercised
// indirectly by the discovery suite's tag-archive tests.
describe.skip("tags rendering on detail page", () => {
  test("alpha renders both of its tags as #-prefixed links", () => {
    const html = read(join(DIST, "work", "alpha", "index.html"));
    expect(html).toMatch(/href="\/tags\/software\/"[^>]*rel="tag"/);
    expect(html).toMatch(/href="\/tags\/saas\/"[^>]*rel="tag"/);
    expect(html).toMatch(/>#software</);
    expect(html).toMatch(/>#saas</);
  });
});

describe("U-20 — first-load HTML budget on portfolio routes", () => {
  test("/work/ index <50KB gzipped", () => {
    expect(gzipBytes(read(WORK_INDEX))).toBeLessThan(50_000);
  });
  test.skip("each project detail page <50KB gzipped", () => {
    // SKIP: detail pages removed.
  });
});

describe("W-1 — no external client JS on portfolio routes", () => {
  test("/work/ index has no external <script src=…>", () => {
    const html = read(WORK_INDEX);
    expect(html).not.toMatch(/<script[^>]+src=["'][^"']+["']/);
  });
  test.skip("each project detail page has no external <script src=…>", () => {
    // SKIP: detail pages removed.
  });
});

// SKIP: detail pages removed.
describe.skip("C-6 — BaseLayout composition on detail page", () => {
  const expectedAttrs: Array<[string, RegExp]> = [
    ["charset utf-8", /<meta charset="utf-8">/i],
    ["viewport meta", /<meta name="viewport"/i],
    ["theme boot inline script", /dataset\.theme/],
    ["og:title", /property="og:title"/],
    ["og:description", /property="og:description"/],
    ["skip-link", /<a[^>]*class="skip-link"[^>]*href="#main"/],
    ["main landmark", /<main[^>]*id="main"/],
    ["header banner", /<header[^>]*role="banner"/],
    ["footer contentinfo", /<footer[^>]*role="contentinfo"/],
    ["theme toggle", /data-theme-toggle/],
  ];

  test.each(expectedAttrs)("project detail emits %s", (_label, pattern) => {
    for (const file of listProjectHtml()) {
      const html = read(file);
      expect(html).toMatch(pattern);
    }
  });
});
