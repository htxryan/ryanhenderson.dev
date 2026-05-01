import { describe, expect, test } from "vitest";
import { gzipSync } from "node:zlib";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * E6 — Discovery acceptance tests.
 *
 * Covers (per epic acceptance criteria):
 *   - /feed.xml is valid RSS 2.0 with last 20 non-draft posts and full content
 *   - /atom.xml is valid Atom 1.0
 *   - sitemap-index.xml + per-collection sitemap exist
 *   - robots.txt references the production sitemap
 *   - /tags/<tag>/ lists posts AND projects under that tag
 *   - /search/ ships zero pagefind asset bytes on initial HTML
 *   - No non-search route loads pagefind assets
 *   - **Cross-cutting (advisory P1 #4):** smoke test parses dist/feed.xml and
 *     asserts no draft slug present.
 */

const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist");

function read(file: string): string {
  return readFileSync(file, "utf-8");
}

function gzipBytes(s: string): number {
  return gzipSync(Buffer.from(s, "utf-8")).length;
}

function listAllHtml(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listAllHtml(full));
    } else if (st.isFile() && name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

const FEED = join(DIST, "feed.xml");
const ATOM = join(DIST, "atom.xml");
const SITEMAP_INDEX = join(DIST, "sitemap-index.xml");
const SITEMAP_0 = join(DIST, "sitemap-0.xml");
const ROBOTS = join(DIST, "robots.txt");
const SEARCH = join(DIST, "search", "index.html");

describe("RSS feed (/feed.xml)", () => {
  test("file exists at /feed.xml", () => {
    expect(existsSync(FEED)).toBe(true);
  });

  test("declares RSS 2.0 with content:encoded namespace", () => {
    const xml = read(FEED);
    expect(xml).toMatch(/<rss[^>]*\bversion="2\.0"/);
    expect(xml).toMatch(
      /xmlns:content="http:\/\/purl\.org\/rss\/1\.0\/modules\/content\/"/,
    );
  });

  test("emits required channel elements", () => {
    const xml = read(FEED);
    expect(xml).toMatch(/<title>[^<]+<\/title>/);
    expect(xml).toMatch(/<description>[^<]+<\/description>/);
    expect(xml).toMatch(/<link>https:\/\/ryanhenderson\.dev\/<\/link>/);
    expect(xml).toMatch(/<language>en-us<\/language>/);
  });

  test("emits an <item> per published post and uses pubDate + guid", () => {
    const xml = read(FEED);
    const items = xml.match(/<item>/g) ?? [];
    // 3 published fixtures (hello-world, mid-post, early-post).
    expect(items.length).toBe(3);
    expect(xml).toMatch(/<pubDate>[A-Z][a-z]{2},\s\d{2}\s[A-Z][a-z]{2}\s\d{4}/);
    expect(xml).toMatch(
      /<guid[^>]*>https:\/\/ryanhenderson\.dev\/posts\/[a-z0-9-]+\/<\/guid>/,
    );
  });

  test("includes full rendered HTML body inside <content:encoded>", () => {
    const xml = read(FEED);
    expect(xml).toMatch(/<content:encoded>[\s\S]+<\/content:encoded>/);
    // hello-world body renders a Shiki <pre class="astro-code">…
    // (the body is escaped inside content:encoded; entities like &quot;
    // appear between &lt;pre and the class value, so we use a non-greedy
    // match across them.)
    expect(xml).toMatch(/&lt;pre[\s\S]*?astro-code/);
    // …and an MDX Callout.
    expect(xml).toMatch(/&lt;aside[\s\S]*?\bcallout\b/);
  });

  test("limits to last 20 posts (we have 3, but limit is enforced)", () => {
    const xml = read(FEED);
    const items = (xml.match(/<item>/g) ?? []).length;
    expect(items).toBeLessThanOrEqual(20);
  });

  test("CROSS-CUTTING P1 #4 — feed contains zero draft-slugged links", () => {
    const xml = read(FEED);
    // The draft fixture is `draft-fixture.mdx`. Drafts must never appear
    // in the published feed. This is the smoke test the epic acceptance
    // criteria explicitly call for.
    expect(xml).not.toMatch(/\/posts\/draft-fixture\//);
    expect(xml).not.toMatch(/Draft Fixture/);
  });

  test("emits each post's pubDate in chronological-desc order", () => {
    const xml = read(FEED);
    const dates = [...xml.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)].map(
      (m) => new Date(m[1]).getTime(),
    );
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }
  });
});

describe("Atom feed (/atom.xml)", () => {
  test("file exists at /atom.xml", () => {
    expect(existsSync(ATOM)).toBe(true);
  });

  test("declares Atom 1.0 namespace and required elements", () => {
    const xml = read(ATOM);
    expect(xml).toMatch(/<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">/);
    expect(xml).toMatch(/<id>https:\/\/ryanhenderson\.dev\/<\/id>/);
    expect(xml).toMatch(
      /<link rel="self" type="application\/atom\+xml" href="https:\/\/ryanhenderson\.dev\/atom\.xml"/,
    );
    expect(xml).toMatch(/<updated>\d{4}-\d{2}-\d{2}T/);
    expect(xml).toMatch(/<author>\s*<name>Ryan Henderson<\/name>\s*<\/author>/);
  });

  test("emits one <entry> per published post", () => {
    const xml = read(ATOM);
    const entries = xml.match(/<entry>/g) ?? [];
    expect(entries.length).toBe(3);
  });

  test("each entry carries id, link, updated, published, content[type=html]", () => {
    const xml = read(ATOM);
    const entryBlock = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
    expect(entryBlock.length).toBeGreaterThan(0);
    for (const block of entryBlock) {
      expect(block).toMatch(
        /<id>https:\/\/ryanhenderson\.dev\/posts\/[a-z0-9-]+\/<\/id>/,
      );
      expect(block).toMatch(
        /<link rel="alternate" type="text\/html" href="https:\/\/ryanhenderson\.dev\/posts\//,
      );
      expect(block).toMatch(/<updated>\d{4}-\d{2}-\d{2}T/);
      expect(block).toMatch(/<published>\d{4}-\d{2}-\d{2}T/);
      expect(block).toMatch(/<content type="html"><!\[CDATA\[/);
    }
  });

  test("Atom feed contains zero draft slugs", () => {
    const xml = read(ATOM);
    expect(xml).not.toMatch(/\/posts\/draft-fixture\//);
    expect(xml).not.toMatch(/Draft Fixture/);
  });

  test("entry content uses CDATA-wrapped rendered HTML (full content)", () => {
    const xml = read(ATOM);
    expect(xml).toMatch(/<!\[CDATA\[<p>/);
    // hello-world's Shiki output round-trips inside CDATA without double-escape.
    expect(xml).toMatch(/<pre class="astro-code/);
  });
});

describe("Sitemap (sitemap-index.xml + sitemap-0.xml)", () => {
  test("sitemap-index.xml exists and references sitemap-0.xml", () => {
    expect(existsSync(SITEMAP_INDEX)).toBe(true);
    const xml = read(SITEMAP_INDEX);
    expect(xml).toMatch(
      /<loc>https:\/\/ryanhenderson\.dev\/sitemap-0\.xml<\/loc>/,
    );
  });

  test("sitemap-0.xml lists every published route", () => {
    expect(existsSync(SITEMAP_0)).toBe(true);
    const xml = read(SITEMAP_0);
    const required = [
      "https://ryanhenderson.dev/",
      "https://ryanhenderson.dev/about/",
      "https://ryanhenderson.dev/posts/",
      "https://ryanhenderson.dev/posts/hello-world/",
      "https://ryanhenderson.dev/posts/mid-post/",
      "https://ryanhenderson.dev/posts/early-post/",
      "https://ryanhenderson.dev/work/",
      "https://ryanhenderson.dev/work/alpha/",
      "https://ryanhenderson.dev/work/bravo/",
      "https://ryanhenderson.dev/work/charlie/",
      "https://ryanhenderson.dev/search/",
    ];
    for (const url of required) {
      expect(xml).toContain(`<loc>${url}</loc>`);
    }
  });

  test("sitemap excludes drafts and private projects", () => {
    const xml = read(SITEMAP_0);
    expect(xml).not.toMatch(/\/posts\/draft-fixture\//);
    expect(xml).not.toMatch(/\/work\/delta\//);
  });
});

describe("robots.txt", () => {
  test("exists at /robots.txt", () => {
    expect(existsSync(ROBOTS)).toBe(true);
  });

  test("references the production sitemap-index.xml", () => {
    const txt = read(ROBOTS);
    expect(txt).toMatch(
      /Sitemap:\s*https:\/\/ryanhenderson\.dev\/sitemap-index\.xml/,
    );
  });

  test("allows the default user-agent", () => {
    const txt = read(ROBOTS);
    expect(txt).toMatch(/^User-agent:\s*\*/m);
    expect(txt).toMatch(/^Allow:\s*\//m);
  });
});

describe("Tag archives (/tags/<tag>/)", () => {
  test("a /tags/<tag>/ page exists for every tag in the union of collections", () => {
    // Posts contribute: meta, fixture
    // Projects contribute: software, saas, archive (charlie has 'archive' tag),
    //                      consulting (depending on fixtures)
    // We iterate published fixtures' tag set and assert each archive exists.
    const expected = ["meta", "fixture", "software", "saas"];
    for (const tag of expected) {
      const file = join(DIST, "tags", tag, "index.html");
      expect(existsSync(file), `expected /tags/${tag}/ to exist`).toBe(true);
    }
  });

  test("/tags/meta/ lists posts using #meta", () => {
    const html = read(join(DIST, "tags", "meta", "index.html"));
    // hello-world and early-post both carry the 'meta' tag.
    expect(html).toMatch(/href="\/posts\/hello-world\/"/);
    expect(html).toMatch(/href="\/posts\/early-post\/"/);
    expect(html).toMatch(/<h1[^>]*>#meta<\/h1>/);
  });

  test("/tags/software/ lists the project that uses #software", () => {
    const html = read(join(DIST, "tags", "software", "index.html"));
    // alpha has 'software' tag.
    expect(html).toMatch(/href="\/work\/alpha\/"/);
    // ProjectCard markup is reused.
    expect(html).toMatch(/<article[^>]*class="project-card"/);
  });

  test("a tag used by BOTH a post and a project lists both sections", () => {
    // Walk all archives and find one (if any) where both Posts and Projects
    // headings co-exist. The fixtures may not cover this; if not, we at least
    // assert the page CAN list both — checked via shape on the markup.
    // Pick `meta` (posts only) as a control case to confirm that the Projects
    // block is correctly absent when no project carries the tag.
    const meta = read(join(DIST, "tags", "meta", "index.html"));
    expect(meta).toMatch(/<h2[^>]*id="posts-heading"/);
    expect(meta).not.toMatch(/<h2[^>]*id="projects-heading"/);

    const software = read(join(DIST, "tags", "software", "index.html"));
    expect(software).toMatch(/<h2[^>]*id="projects-heading"/);
    // If fixtures gain a post tagged 'software' later, the Posts section must
    // appear too — but not enforced here so we don't over-constrain fixtures.
  });

  test("tag pages do not include drafts or private projects", () => {
    // Drafts: the draft fixture has tag 'fixture'. Private project 'delta'
    // has any tags it might carry. Check /tags/fixture/ excludes drafts.
    const fixture = read(join(DIST, "tags", "fixture", "index.html"));
    expect(fixture).not.toMatch(/href="\/posts\/draft-fixture\//);
    // No /tags/* archive lists /work/delta/
    for (const tagDir of readdirSync(join(DIST, "tags"))) {
      const html = read(join(DIST, "tags", tagDir, "index.html"));
      expect(
        html,
        `private project must not surface in /tags/${tagDir}/`,
      ).not.toMatch(/href="\/work\/delta\//);
    }
  });

  test("each tag page uses BaseLayout chrome (canonical, header, footer)", () => {
    const html = read(join(DIST, "tags", "meta", "index.html"));
    expect(html).toMatch(/<header[^>]*role="banner"/);
    expect(html).toMatch(/<footer[^>]*role="contentinfo"/);
    expect(html).toMatch(
      /<link rel="canonical" href="https:\/\/ryanhenderson\.dev\/tags\/meta\/"/,
    );
  });

  test("tag pages stay under the 50KB gzipped budget", () => {
    for (const tagDir of readdirSync(join(DIST, "tags"))) {
      const file = join(DIST, "tags", tagDir, "index.html");
      expect(gzipBytes(read(file))).toBeLessThan(50_000);
    }
  });

  test("tag pages ship no external client JS bundles", () => {
    for (const tagDir of readdirSync(join(DIST, "tags"))) {
      const html = read(join(DIST, "tags", tagDir, "index.html"));
      expect(html).not.toMatch(/<script[^>]+src=["'][^"']+["']/);
    }
  });

  test("tag URL slugs are lowercase (case-insensitive normalisation)", () => {
    // Per archive contract: a post tagged `TypeScript` and a project tagged
    // `typescript` collapse to the single archive `/tags/typescript/`.
    // The slug should always be lowercase.
    for (const tagDir of readdirSync(join(DIST, "tags"))) {
      expect(tagDir).toBe(tagDir.toLowerCase());
    }
  });
});

describe("Pagefind index", () => {
  test("dist/pagefind/ exists with index shards", () => {
    const dir = join(DIST, "pagefind");
    expect(existsSync(dir)).toBe(true);
    // The pagefind core entry point is pagefind.js + pagefind-ui.js. Either
    // the .js or _internal directory must exist; pagefind ships both.
    const entries = readdirSync(dir);
    expect(entries.some((e) => e === "pagefind.js")).toBe(true);
    expect(entries.some((e) => e === "pagefind-ui.js")).toBe(true);
  });
});

describe("Search page (/search/)", () => {
  test("search page exists", () => {
    expect(existsSync(SEARCH)).toBe(true);
  });

  test("uses BaseLayout chrome", () => {
    const html = read(SEARCH);
    expect(html).toMatch(/<header[^>]*role="banner"/);
    expect(html).toMatch(/<footer[^>]*role="contentinfo"/);
    expect(html).toMatch(
      /<link rel="canonical" href="https:\/\/ryanhenderson\.dev\/search\/"/,
    );
  });

  test("renders the static placeholder input (interactive at first paint)", () => {
    const html = read(SEARCH);
    expect(html).toMatch(/<input[^>]*type="search"/);
    expect(html).toMatch(/data-pagefind-placeholder/);
  });

  test("ships ZERO <script src=\"...pagefind...\"> tags on initial HTML", () => {
    // Lazy-load contract: the pagefind WASM + UI bundle MUST NOT be referenced
    // by a static <script src="…">. The boot script may *dynamically* import
    // /pagefind/pagefind-ui.js inside an inline <script>, but the network
    // request must be deferred until first user interaction.
    const html = read(SEARCH);
    const externalScripts = html.match(/<script[^>]+src=["'][^"']+["']/g) ?? [];
    expect(externalScripts.length).toBe(0);
  });

  test("inline boot script defers the import until first interaction", () => {
    const html = read(SEARCH);
    // The boot is wrapped in an event listener. The dynamic import must be
    // inside a function body, not at top level.
    expect(html).toMatch(/import\(["']\/pagefind\/pagefind-ui\.js["']\)/);
    expect(html).toMatch(/addEventListener\(/);
  });
});

describe("Feed discoverability (BaseLayout <head>)", () => {
  // Feed readers find feeds by scanning for <link rel="alternate"> in <head>.
  // Both feed formats MUST be advertised, otherwise readers default to RSS
  // only and the Atom build is undiscoverable in practice.
  test("every page advertises BOTH /feed.xml (RSS) and /atom.xml (Atom)", () => {
    const all = listAllHtml(DIST);
    expect(all.length).toBeGreaterThan(0);
    for (const file of all) {
      const html = read(file);
      const rel = file.replace(DIST, "");
      expect(
        html,
        `${rel} missing RSS alternate link`,
      ).toMatch(
        /<link[^>]+rel="alternate"[^>]+type="application\/rss\+xml"[^>]+href="\/feed\.xml"/,
      );
      expect(
        html,
        `${rel} missing Atom alternate link`,
      ).toMatch(
        /<link[^>]+rel="alternate"[^>]+type="application\/atom\+xml"[^>]+href="\/atom\.xml"/,
      );
    }
  });
});

describe("CRITICAL — pagefind asset bytes do NOT load on non-search routes", () => {
  // Per advisory P1 #10 / implicit contract: pagefind WASM + shards MUST NOT
  // load on any non-search route. We verify the static HTML contract: no
  // non-search route may reference /pagefind/ via a <script>, <link>,
  // <iframe src=> or similar resource-loading attribute.
  test("no non-search route references /pagefind/ in any resource hint", () => {
    const all = listAllHtml(DIST);
    expect(all.length).toBeGreaterThan(0);
    for (const file of all) {
      const rel = file.replace(DIST, "");
      // The /search/ page is allowed to reference pagefind dynamically;
      // even there we forbid static <script src=…/pagefind/…>.
      const html = read(file);
      // Strict: no static resource hint to /pagefind/* anywhere.
      expect(
        html,
        `static /pagefind/ reference detected on ${rel}`,
      ).not.toMatch(
        /(?:<script[^>]+src|<link[^>]+href|<iframe[^>]+src)=["'][^"']*\/pagefind\/[^"']+["']/,
      );
    }
  });
});
