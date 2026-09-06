import { describe, expect, test } from "vitest";
import { blogSchema, projectSchema } from "../src/content/schemas";

describe("blogSchema", () => {
  test("accepts a minimal valid post", () => {
    const result = blogSchema.parse({
      title: "Hello",
      pubDate: "2026-04-30",
      summary: "A short summary.",
    });
    expect(result.title).toBe("Hello");
    expect(result.draft).toBe(false);
    expect(result.tags).toEqual([]);
    expect(result.pubDate).toBeInstanceOf(Date);
  });

  test("accepts every optional field", () => {
    const result = blogSchema.parse({
      title: "Hello",
      pubDate: "2026-04-30",
      summary: "A short summary.",
      tags: ["a", "b"],
      draft: true,
      updated: "2026-05-01",
      canonicalUrl: "https://example.com/x",
    });
    expect(result.tags).toEqual(["a", "b"]);
    expect(result.draft).toBe(true);
    expect(result.canonicalUrl).toBe("https://example.com/x");
  });

  test("rejects unknown frontmatter keys (.strict)", () => {
    expect(() =>
      blogSchema.parse({
        title: "Hello",
        pubDate: "2026-04-30",
        summary: "x",
        // typo of "tags" — must fail loud
        taggz: ["a"],
      }),
    ).toThrow(/Unrecognized key|unknown/i);
  });

  test("rejects empty title", () => {
    expect(() =>
      blogSchema.parse({
        title: "",
        pubDate: "2026-04-30",
        summary: "x",
      }),
    ).toThrow();
  });

  test("rejects summary > 200 chars", () => {
    expect(() =>
      blogSchema.parse({
        title: "x",
        pubDate: "2026-04-30",
        summary: "y".repeat(201),
      }),
    ).toThrow();
  });

  test("rejects missing required fields", () => {
    expect(() => blogSchema.parse({ title: "x" })).toThrow();
  });

  test("rejects malformed canonicalUrl", () => {
    expect(() =>
      blogSchema.parse({
        title: "x",
        pubDate: "2026-04-30",
        summary: "x",
        canonicalUrl: "not a url",
      }),
    ).toThrow();
  });
});

describe("projectSchema", () => {
  test("accepts a minimal valid project", () => {
    const result = projectSchema.parse({
      name: "Acme",
      oneLiner: "A thing.",
      status: "active",
      marketingUrl: "https://acme.example",
    });
    expect(result.name).toBe("Acme");
    expect(result.tags).toEqual([]);
    expect(result.repoUrl).toBeUndefined();
  });

  test("accepts a project in development without public links", () => {
    const result = projectSchema.parse({
      name: "Menu Simplifier",
      oneLiner: "Understand a menu.",
      status: "in-development",
    });
    expect(result.marketingUrl).toBeUndefined();
    expect(result.repoUrl).toBeUndefined();
    expect(result.status).toBe("in-development");
  });

  test("accepts every optional field", () => {
    const result = projectSchema.parse({
      name: "Acme",
      oneLiner: "A thing.",
      status: "archived",
      marketingUrl: "https://acme.example",
      repoUrl: "https://github.com/x/y",
      tags: ["a"],
      pubDate: "2026-01-01",
    });
    expect(result.repoUrl).toBe("https://github.com/x/y");
    expect(result.pubDate).toBeInstanceOf(Date);
  });

  test("rejects status outside enum", () => {
    expect(() =>
      projectSchema.parse({
        name: "Acme",
        oneLiner: "x",
        status: "draft",
        marketingUrl: "https://x.example",
      }),
    ).toThrow();
  });

  test("rejects unknown frontmatter keys (.strict)", () => {
    expect(() =>
      projectSchema.parse({
        name: "Acme",
        oneLiner: "x",
        status: "active",
        marketingUrl: "https://x.example",
        rogue: true,
      }),
    ).toThrow(/Unrecognized key|unknown/i);
  });

  test("rejects oneLiner > 140 chars", () => {
    expect(() =>
      projectSchema.parse({
        name: "Acme",
        oneLiner: "x".repeat(141),
        status: "active",
        marketingUrl: "https://x.example",
      }),
    ).toThrow();
  });

  test("rejects malformed marketingUrl", () => {
    expect(() =>
      projectSchema.parse({
        name: "Acme",
        oneLiner: "x",
        status: "active",
        marketingUrl: "not a url",
      }),
    ).toThrow();
  });
});

describe("tag normalization (shared)", () => {
  const valid = {
    title: "x",
    pubDate: "2026-04-30",
    summary: "x",
  };

  test("lowercases tags so /tags/<tag>/ links match the archive route slug", () => {
    const result = blogSchema.parse({ ...valid, tags: ["TypeScript", "MDX"] });
    expect(result.tags).toEqual(["typescript", "mdx"]);
  });

  test("rejects tags with characters that would produce malformed URLs", () => {
    // `.`, `+`, `/`, whitespace are all common author mistakes for "node.js"
    // / "c++" / "front end" — fail loud, don't emit broken hrefs.
    expect(() =>
      blogSchema.parse({ ...valid, tags: ["node.js"] }),
    ).toThrow();
    expect(() =>
      blogSchema.parse({ ...valid, tags: ["c++"] }),
    ).toThrow();
    expect(() =>
      blogSchema.parse({ ...valid, tags: ["front end"] }),
    ).toThrow();
    expect(() =>
      blogSchema.parse({ ...valid, tags: ["a/b"] }),
    ).toThrow();
  });

  test("accepts hyphens (the conventional slug separator)", () => {
    const result = blogSchema.parse({
      ...valid,
      tags: ["case-study", "deep-dive"],
    });
    expect(result.tags).toEqual(["case-study", "deep-dive"]);
  });

  test("rejects empty-string tags", () => {
    expect(() =>
      blogSchema.parse({ ...valid, tags: [""] }),
    ).toThrow();
  });

  test("project tags are normalised the same way", () => {
    const result = projectSchema.parse({
      name: "Acme",
      oneLiner: "x",
      status: "active",
      marketingUrl: "https://x.example",
      tags: ["SaaS", "Software"],
    });
    expect(result.tags).toEqual(["saas", "software"]);
  });
});
