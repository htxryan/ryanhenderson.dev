import { describe, expect, test, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { XMLParser, XMLValidator } from "fast-xml-parser";

/**
 * IV-4 — RSS + Atom + Sitemap structural validation.
 *
 * The per-epic discovery suite (tests/discovery.test.ts) asserts shape via
 * regex. This file adds the integration-verification layer: it parses the
 * built feeds with a real XML parser, then asserts the structural rules
 * external validators (feedvalidator.org, w3c-feed-validator, the
 * sitemaps.org schema) would enforce. Catches failures regex would miss:
 * malformed CDATA, invalid date formats per RFC 822 / RFC 3339, namespace
 * drift, optional-element type errors.
 *
 * Contracts under test:
 *   - C-7  RSS 2.0 shape (cross-epic, external consumer)
 *   - C-8  Sitemap 0.9 + robots.txt (cross-epic, external consumer)
 *   - Atom 1.0 (parallel feed format we publish)
 */

const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist");

beforeAll(() => {
  if (!existsSync(join(DIST, "feed.xml"))) {
    throw new Error("Expected globalSetup to produce dist/feed.xml");
  }
});

function read(rel: string): string {
  return readFileSync(join(DIST, rel), "utf-8");
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  cdataPropName: "#cdata",
  // Preserve order isn't necessary; we assert per-element. Numbers stay
  // strings so we can test exact wire format (e.g. 0-padded dates).
  parseAttributeValue: false,
  parseTagValue: false,
});

// RFC 822 (RSS pubDate) — example: "Fri, 20 Feb 2026 00:00:00 GMT"
const RFC_822 = /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} (GMT|[+-]\d{4})$/;
// RFC 3339 (Atom + sitemap lastmod) — example: "2026-04-30T00:00:00.000Z"
const RFC_3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

describe("RSS 2.0 (/feed.xml) — structural validation", () => {
  const xml = read("feed.xml");

  test("XML parses without error (well-formed)", () => {
    const result = XMLValidator.validate(xml);
    expect(result, JSON.stringify(result)).toBe(true);
  });

  test("declares xmlns:content (content:encoded namespace)", () => {
    const tree = parser.parse(xml);
    expect(tree.rss["@_xmlns:content"]).toBe(
      "http://purl.org/rss/1.0/modules/content/",
    );
  });

  test("rss/@version === '2.0'", () => {
    const tree = parser.parse(xml);
    expect(tree.rss["@_version"]).toBe("2.0");
  });

  test("channel has title, link, description, language", () => {
    const ch = parser.parse(xml).rss.channel;
    expect(typeof ch.title).toBe("string");
    expect(ch.title.length).toBeGreaterThan(0);
    expect(ch.link).toMatch(/^https:\/\//);
    expect(typeof ch.description).toBe("string");
    expect(ch.language).toBe("en-us");
  });

  test("every <item> has title, link, guid, pubDate (RFC 822), content:encoded", () => {
    const ch = parser.parse(xml).rss.channel;
    const items = Array.isArray(ch.item) ? ch.item : [ch.item];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(typeof item.title).toBe("string");
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.link).toMatch(/^https:\/\/ryanhenderson\.dev\/posts\/[a-z0-9-]+\/$/);
      // guid is required and should be a permalink.
      const guid = typeof item.guid === "string" ? item.guid : item.guid["#text"];
      expect(guid).toMatch(/^https:\/\//);
      const isPerma = typeof item.guid === "object" ? item.guid["@_isPermaLink"] : "true";
      expect(isPerma).toBe("true");
      // pubDate must match RFC 822 (this is the failure mode regex tests miss).
      expect(item.pubDate, `pubDate not RFC 822: ${item.pubDate}`).toMatch(RFC_822);
      expect(typeof item["content:encoded"]).toBe("string");
      expect(item["content:encoded"].length).toBeGreaterThan(0);
    }
  });

  test("item ordering is descending by pubDate", () => {
    const ch = parser.parse(xml).rss.channel;
    const items = Array.isArray(ch.item) ? ch.item : [ch.item];
    for (let i = 1; i < items.length; i++) {
      const prev = new Date(items[i - 1].pubDate).getTime();
      const cur = new Date(items[i].pubDate).getTime();
      // Guard against silent NaN propagation if the RFC-822 regex regresses
      // — `NaN >= NaN` is false but the failure message would hide the cause.
      expect(
        Number.isFinite(prev) && Number.isFinite(cur),
        `unparseable pubDate(s): prev=${items[i - 1].pubDate}, cur=${items[i].pubDate}`,
      ).toBe(true);
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
  });

  test("zero draft slugs leak into items[]", () => {
    const ch = parser.parse(xml).rss.channel;
    const items = Array.isArray(ch.item) ? ch.item : [ch.item];
    for (const item of items) {
      expect(item.link).not.toMatch(/draft-fixture/);
      expect(item.link).not.toMatch(/the-cost-of-estimation/);
    }
  });
});

describe("Atom 1.0 (/atom.xml) — structural validation", () => {
  const xml = read("atom.xml");

  test("XML parses without error", () => {
    const result = XMLValidator.validate(xml);
    expect(result, JSON.stringify(result)).toBe(true);
  });

  test("root is <feed xmlns='http://www.w3.org/2005/Atom'>", () => {
    const tree = parser.parse(xml);
    expect(tree.feed["@_xmlns"]).toBe("http://www.w3.org/2005/Atom");
  });

  test("feed has id (URI), title, updated (RFC 3339), author/name", () => {
    const f = parser.parse(xml).feed;
    expect(f.id).toMatch(/^https:\/\//);
    expect(typeof f.title).toBe("string");
    expect(f.updated).toMatch(RFC_3339);
    expect(f.author?.name).toBe("Ryan Henderson");
  });

  test("self link is application/atom+xml and points at /atom.xml", () => {
    const f = parser.parse(xml).feed;
    const links = Array.isArray(f.link) ? f.link : [f.link];
    const self = links.find((l: { "@_rel"?: string }) => l["@_rel"] === "self");
    expect(self, "no self link").toBeDefined();
    expect(self["@_type"]).toBe("application/atom+xml");
    expect(self["@_href"]).toBe("https://ryanhenderson.dev/atom.xml");
  });

  test("every <entry> has id (URI), title, updated, published, content[type=html]", () => {
    const f = parser.parse(xml).feed;
    const entries = Array.isArray(f.entry) ? f.entry : [f.entry];
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.id).toMatch(/^https:\/\/ryanhenderson\.dev\/posts\/[a-z0-9-]+\/$/);
      expect(typeof e.title).toBe("string");
      expect(e.updated, `updated not RFC 3339: ${e.updated}`).toMatch(RFC_3339);
      expect(e.published, `published not RFC 3339: ${e.published}`).toMatch(RFC_3339);
      expect(e.content["@_type"]).toBe("html");
      // content body lives in #cdata when CDATA-wrapped (or #text otherwise).
      const body = e.content["#cdata"] ?? e.content["#text"];
      expect(typeof body).toBe("string");
      expect(body.length).toBeGreaterThan(0);
    }
  });

  test("zero draft slugs leak into entries[]", () => {
    const f = parser.parse(xml).feed;
    const entries = Array.isArray(f.entry) ? f.entry : [f.entry];
    for (const e of entries) {
      expect(e.id).not.toMatch(/draft-fixture/);
      expect(e.id).not.toMatch(/the-cost-of-estimation/);
    }
  });
});

describe("Sitemap 0.9 — structural validation", () => {
  const indexXml = read("sitemap-index.xml");
  const urlsetXml = read("sitemap-0.xml");

  test("sitemap-index.xml is well-formed XML", () => {
    expect(XMLValidator.validate(indexXml)).toBe(true);
  });

  test("sitemap-index root is <sitemapindex xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'>", () => {
    const tree = parser.parse(indexXml);
    expect(tree.sitemapindex["@_xmlns"]).toBe(
      "http://www.sitemaps.org/schemas/sitemap/0.9",
    );
  });

  test("sitemap-index lists at least one <sitemap> with a <loc>", () => {
    const idx = parser.parse(indexXml).sitemapindex;
    const list = Array.isArray(idx.sitemap) ? idx.sitemap : [idx.sitemap];
    expect(list.length).toBeGreaterThan(0);
    for (const s of list) {
      expect(s.loc).toMatch(/^https:\/\//);
    }
  });

  test("sitemap-0.xml is well-formed XML", () => {
    expect(XMLValidator.validate(urlsetXml)).toBe(true);
  });

  test("sitemap-0 root is <urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'>", () => {
    const tree = parser.parse(urlsetXml);
    expect(tree.urlset["@_xmlns"]).toBe(
      "http://www.sitemaps.org/schemas/sitemap/0.9",
    );
  });

  test("every <url> has a <loc> that is an absolute https:// URL on our domain", () => {
    const set = parser.parse(urlsetXml).urlset;
    const urls = Array.isArray(set.url) ? set.url : [set.url];
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) {
      expect(u.loc).toMatch(/^https:\/\/ryanhenderson\.dev\//);
      // If lastmod present, it must be RFC 3339 (full date-time) or an
      // ISO 8601 calendar date (YYYY-MM-DD).
      if (u.lastmod) {
        const ok = RFC_3339.test(u.lastmod) || /^\d{4}-\d{2}-\d{2}$/.test(u.lastmod);
        expect(ok, `lastmod malformed: ${u.lastmod}`).toBe(true);
      }
    }
  });

  test("no draft slugs in sitemap-0", () => {
    const set = parser.parse(urlsetXml).urlset;
    const urls = Array.isArray(set.url) ? set.url : [set.url];
    for (const u of urls) {
      expect(u.loc).not.toMatch(/draft-fixture/);
      expect(u.loc).not.toMatch(/the-cost-of-estimation/);
    }
  });

  test("loc URLs are unique (no duplicate entries)", () => {
    const set = parser.parse(urlsetXml).urlset;
    const urls = Array.isArray(set.url) ? set.url : [set.url];
    const seen = new Set<string>();
    for (const u of urls) {
      expect(seen.has(u.loc), `duplicate loc: ${u.loc}`).toBe(false);
      seen.add(u.loc);
    }
  });
});

describe("robots.txt — referenced sitemap matches what is shipped", () => {
  test("robots.txt advertises the sitemap-index URL", () => {
    const txt = read("robots.txt");
    expect(txt).toMatch(
      /Sitemap:\s+https:\/\/ryanhenderson\.dev\/sitemap-index\.xml/,
    );
  });

  test("the advertised URL resolves to the on-disk sitemap-index.xml", () => {
    expect(existsSync(join(DIST, "sitemap-index.xml"))).toBe(true);
  });
});
