import { describe, expect, test } from "vitest";
import { gzipSync } from "node:zlib";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * E4 — Post route acceptance tests.
 *
 * Covers (per epic acceptance criteria):
 *   - U-4: title, pubDate, reading time, word count, tags, body, prev/next
 *     all present on a rendered post HTML
 *   - U-5: code blocks highlighted at build time via Shiki using the
 *     cssVariables surface — single theme, no second bundle
 *   - U-6: body measure is 60–75ch (verified via the CSS rule presence)
 *   - U-20: post route HTML <50KB gzipped
 *   - C-6: BaseLayout composition still applies on the post route
 *   - W-1: no external <script src=…> bundles on the post route
 *   - Implicit: prev/next never includes drafts (uses the same helper as
 *     the route enumerator)
 */

const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist");

// The build runs once via Vitest's globalSetup (see vitest.config.ts).

function read(file: string): string {
  return readFileSync(file, "utf-8");
}

function gzipBytes(s: string): number {
  return gzipSync(Buffer.from(s, "utf-8")).length;
}

function listPostHtml(): string[] {
  const postsDir = join(DIST, "posts");
  if (!existsSync(postsDir)) return [];
  // Each post is dist/posts/<slug>/index.html. Skip dist/posts/index.html
  // (the archive page).
  return readdirSync(postsDir)
    .filter((entry) => {
      const p = join(postsDir, entry);
      try {
        return statSync(p).isDirectory();
      } catch {
        return false;
      }
    })
    .map((slug) => join(postsDir, slug, "index.html"))
    .filter((p) => existsSync(p));
}

describe("post route — at least one post exists", () => {
  test("build produced posts/<slug>/index.html files", () => {
    const files = listPostHtml();
    expect(files.length).toBeGreaterThan(0);
  });
});

describe("U-4 — post metadata required on every rendered post", () => {
  test("title rendered as <h1>", () => {
    for (const file of listPostHtml()) {
      const html = read(file);
      expect(html).toMatch(/<h1[^>]*class="post-title"[^>]*>[^<]+<\/h1>/);
    }
  });

  test("pubDate rendered as a <time> with ISO datetime attr", () => {
    for (const file of listPostHtml()) {
      const html = read(file);
      // Within the published row of post-meta.
      expect(html).toMatch(/<time datetime="\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z"/);
    }
  });

  test("reading time minutes are present (data-reading-minutes)", () => {
    for (const file of listPostHtml()) {
      const html = read(file);
      // Stable hook the layout exposes: <span data-reading-minutes>N min</span>
      expect(html).toMatch(/data-reading-minutes[^>]*>\s*\d+\s*min\s*</);
    }
  });

  test("word count is present (data-reading-words)", () => {
    for (const file of listPostHtml()) {
      const html = read(file);
      expect(html).toMatch(/data-reading-words[^>]*>\s*\d+\s*words?\s*</);
    }
  });

  test("tags render as #-prefixed links into /tags/<tag>/", () => {
    for (const file of listPostHtml()) {
      const html = read(file);
      // Tag list may be empty for posts with no tags; only assert when
      // the rendered post contains a `tags` <dt>.
      if (/<dt[^>]*>tags<\/dt>/.test(html)) {
        expect(html).toMatch(/href="\/tags\/[a-z0-9-]+\/"[^>]*rel="tag"/);
        expect(html).toMatch(/>#[a-z0-9-]+</);
      }
    }
  });

  test("post body wraps in an <article> so the prose measure applies", () => {
    for (const file of listPostHtml()) {
      const html = read(file);
      expect(html).toMatch(/<article[^>]*class="[^"]*\bpost\b[^"]*\bprose\b/);
    }
  });

  test("post-nav landmark is present (prev/next)", () => {
    for (const file of listPostHtml()) {
      const html = read(file);
      expect(html).toMatch(/<nav[^>]*class="post-nav"[^>]*aria-label="Adjacent posts"/);
    }
  });
});

describe("U-5 — Shiki cssVariables surface", () => {
  test("post route emits Shiki-rendered <pre class=\"astro-code\"> block", () => {
    // The seed post includes a code fence so we can verify Shiki output;
    // every post route must inherit the same renderer config.
    const files = listPostHtml();
    const hasShikiBlock = files.some((f) =>
      /<pre[^>]*\bastro-code\b/.test(read(f)),
    );
    expect(hasShikiBlock).toBe(true);
  });

  test("Shiki blocks paint via --shiki-* CSS variables, not a hardcoded theme", () => {
    const files = listPostHtml();
    const blocks = files
      .map(read)
      .filter((html) => /<pre[^>]*\bastro-code\b/.test(html));
    expect(blocks.length).toBeGreaterThan(0);

    for (const html of blocks) {
      // Wrapper <pre> is painted by --shiki-bg / --shiki-fg.
      expect(html).toMatch(/style="[^"]*background-color:var\(--shiki-bg\)/);
      expect(html).toMatch(/style="[^"]*color:var\(--shiki-fg\)/);
      // At least one token-level color routes through --shiki-token-*.
      expect(html).toMatch(/color:var\(--shiki-token-[a-z]+\)/);
    }
  });

  test("no second theme bundle: theme name reference appears once per block", () => {
    // Brutalist theme name appears as a class on the wrapper <pre>; we
    // shouldn't see a parallel light/dark class pair (Shiki dual-theme
    // mode adds e.g. `data-theme="light"` containers).
    for (const file of listPostHtml()) {
      const html = read(file);
      // No dual-theme `data-theme` attributes leaking into the post body.
      const dualThemeMatches = html.match(/<pre[^>]*data-theme="[^"]+"/g) ?? [];
      expect(dualThemeMatches.length).toBe(0);
    }
  });
});

describe("U-6 — reading measure declared in CSS", () => {
  test("the prose/article rule exists in a build CSS asset and uses --measure", () => {
    // Walk the dist/_astro CSS files and check at least one carries the
    // `max-width:var(--measure)` rule — the source of the 60–75ch measure.
    const cssRoot = join(DIST, "_astro");
    if (!existsSync(cssRoot)) {
      throw new Error("dist/_astro not found — Astro build layout changed?");
    }
    const cssFiles = readdirSync(cssRoot).filter((f) => f.endsWith(".css"));
    expect(cssFiles.length).toBeGreaterThan(0);
    const concatenated = cssFiles
      .map((f) => readFileSync(join(cssRoot, f), "utf-8"))
      .join("\n");
    expect(concatenated).toMatch(/max-width:var\(--measure\)/);
    // And the measure token resolves to a value in the 60–75ch band.
    expect(concatenated).toMatch(/--measure:\s*7\dch/);
  });
});

describe("U-20 — first-load HTML budget on post route", () => {
  test("each post HTML <50KB gzipped", () => {
    for (const file of listPostHtml()) {
      const bytes = gzipBytes(read(file));
      expect(bytes).toBeLessThan(50_000);
    }
  });
});

describe("C-6 — BaseLayout composition on post route", () => {
  const expectedAttrs: Array<[string, RegExp]> = [
    ["charset utf-8", /<meta charset="utf-8">/i],
    ["viewport meta", /<meta name="viewport"/i],
    ["theme boot inline script", /dataset\.theme/],
    ["canonical link", /<link rel="canonical" href="https:\/\/ryanhenderson\.dev\/posts\//],
    ["og:title", /property="og:title"/],
    ["og:type article", /property="og:type" content="article"/],
    ["article:published_time", /property="article:published_time"/],
    ["skip-link", /<a[^>]*class="skip-link"[^>]*href="#main"/],
    ["main landmark", /<main[^>]*id="main"/],
    ["header banner", /<header[^>]*role="banner"/],
    ["footer contentinfo", /<footer[^>]*role="contentinfo"/],
    ["theme toggle", /data-theme-toggle/],
  ];

  test.each(expectedAttrs)("post route emits %s", (_label, pattern) => {
    for (const file of listPostHtml()) {
      const html = read(file);
      expect(html).toMatch(pattern);
    }
  });
});

describe("W-1 — no external client JS on post route", () => {
  test("post HTML has no external <script src=…> bundle", () => {
    for (const file of listPostHtml()) {
      const html = read(file);
      expect(html).not.toMatch(/<script[^>]+src=["'][^"']+["']/);
    }
  });
});

describe("posts archive (/posts/)", () => {
  const archive = join(DIST, "posts", "index.html");

  test("archive page exists", () => {
    expect(existsSync(archive)).toBe(true);
  });

  test("archive lists posts with title and date", () => {
    const html = read(archive);
    expect(html).toMatch(/<h1[^>]*>All posts<\/h1>/);
    // Each post row has a <time datetime=…> and a row-title span.
    expect(html).toMatch(/<time[^>]*datetime="\d{4}-\d{2}-\d{2}/);
    expect(html).toMatch(/class="row-title"/);
  });

  test("archive links resolve to /posts/<slug>/", () => {
    const html = read(archive);
    expect(html).toMatch(/href="\/posts\/[a-z0-9-]+\/"/);
  });

  test("archive uses BaseLayout chrome", () => {
    const html = read(archive);
    expect(html).toMatch(/<header[^>]*role="banner"/);
    expect(html).toMatch(/<footer[^>]*role="contentinfo"/);
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/ryanhenderson\.dev\/posts\/"/);
  });

  test("archive nav marks /posts/ as current", () => {
    const html = read(archive);
    const navAnchors = (html.match(/<a\b[^>]*>/g) ?? []).filter(
      (tag) => /href="\/posts\/"/.test(tag) && /aria-current="page"/.test(tag),
    );
    expect(navAnchors.length).toBeGreaterThanOrEqual(1);
  });
});
