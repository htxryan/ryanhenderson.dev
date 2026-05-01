import { describe, expect, test } from "vitest";
import {
  filterAndSortPosts,
  filterAndSortProjects,
} from "../src/lib/content-pure";

type AnyEntry = {
  id: string;
  collection: string;
  data: Record<string, unknown>;
};

function postEntry(id: string, pubDate: string, draft = false): AnyEntry {
  return {
    id,
    collection: "blog",
    data: { pubDate: new Date(pubDate), draft },
  };
}

function projectEntry(
  name: string,
  status: "active" | "archived" | "private",
): AnyEntry {
  return {
    id: name.toLowerCase(),
    collection: "projects",
    data: { name, status },
  };
}

describe("filterAndSortPosts", () => {
  test("excludes drafts by default", () => {
    const entries = [
      postEntry("a", "2026-01-01", true),
      postEntry("b", "2026-01-02", false),
    ];
    const out = filterAndSortPosts(entries as never, {});
    expect(out.map((e) => e.id)).toEqual(["b"]);
  });

  test("includeDrafts: true keeps drafts", () => {
    const entries = [
      postEntry("a", "2026-01-01", true),
      postEntry("b", "2026-01-02", false),
    ];
    const out = filterAndSortPosts(entries as never, { includeDrafts: true });
    expect(out.map((e) => e.id)).toEqual(["b", "a"]);
  });

  test("sorts by pubDate desc", () => {
    const entries = [
      postEntry("old", "2024-01-01"),
      postEntry("new", "2026-01-01"),
      postEntry("mid", "2025-06-01"),
    ];
    const out = filterAndSortPosts(entries as never, {});
    expect(out.map((e) => e.id)).toEqual(["new", "mid", "old"]);
  });

  test("breaks pubDate ties with id ascending (deterministic)", () => {
    const entries = [
      postEntry("zebra", "2026-01-01"),
      postEntry("alpha", "2026-01-01"),
      postEntry("mango", "2026-01-01"),
    ];
    const out = filterAndSortPosts(entries as never, {});
    expect(out.map((e) => e.id)).toEqual(["alpha", "mango", "zebra"]);
  });

  test("limit applies after sort", () => {
    const entries = [
      postEntry("a", "2024-01-01"),
      postEntry("b", "2026-01-01"),
      postEntry("c", "2025-01-01"),
    ];
    const out = filterAndSortPosts(entries as never, { limit: 2 });
    expect(out.map((e) => e.id)).toEqual(["b", "c"]);
  });

  test("limit=0 returns empty array", () => {
    const entries = [postEntry("a", "2026-01-01")];
    const out = filterAndSortPosts(entries as never, { limit: 0 });
    expect(out).toEqual([]);
  });

  test("does not mutate input array", () => {
    const entries = [
      postEntry("a", "2024-01-01"),
      postEntry("b", "2026-01-01"),
    ];
    const before = entries.map((e) => e.id);
    filterAndSortPosts(entries as never, { includeDrafts: true });
    expect(entries.map((e) => e.id)).toEqual(before);
  });
});

describe("filterAndSortProjects", () => {
  test("excludes private by default", () => {
    const entries = [
      projectEntry("Alpha", "active"),
      projectEntry("Bravo", "private"),
      projectEntry("Charlie", "archived"),
    ];
    const out = filterAndSortProjects(entries as never, {});
    expect(out.map((e) => e.data.name)).toEqual(["Alpha", "Charlie"]);
  });

  test("includePrivate: true keeps private projects", () => {
    const entries = [
      projectEntry("Alpha", "active"),
      projectEntry("Bravo", "private"),
      projectEntry("Charlie", "archived"),
    ];
    const out = filterAndSortProjects(entries as never, {
      includePrivate: true,
    });
    expect(out.map((e) => e.data.name)).toEqual(["Alpha", "Charlie", "Bravo"]);
  });

  test("orders by status active → archived → private", () => {
    const entries = [
      projectEntry("Yankee", "private"),
      projectEntry("Mike", "archived"),
      projectEntry("Alpha", "active"),
    ];
    const out = filterAndSortProjects(entries as never, {
      includePrivate: true,
    });
    expect(out.map((e) => e.data.status)).toEqual([
      "active",
      "archived",
      "private",
    ]);
  });

  test("breaks status ties with name ascending (deterministic)", () => {
    const entries = [
      projectEntry("Zulu", "active"),
      projectEntry("Alpha", "active"),
      projectEntry("Mike", "active"),
    ];
    const out = filterAndSortProjects(entries as never, {});
    expect(out.map((e) => e.data.name)).toEqual(["Alpha", "Mike", "Zulu"]);
  });

  test("does not mutate input array", () => {
    const entries = [
      projectEntry("Zulu", "active"),
      projectEntry("Alpha", "archived"),
    ];
    const before = entries.map((e) => e.data.name);
    filterAndSortProjects(entries as never, {});
    expect(entries.map((e) => e.data.name)).toEqual(before);
  });
});
