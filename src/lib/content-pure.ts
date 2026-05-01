import type { CollectionEntry } from "astro:content";

export type PublishedPostsOptions = {
  /**
   * Include drafts in the output. The async wrapper in `./content.ts` defaults
   * this to `import.meta.env.DEV`. The pure function here treats `undefined`
   * as `false` so callers must be explicit.
   */
  includeDrafts?: boolean;
  /**
   * Truncate to the first N posts after sorting. Applied after sort.
   */
  limit?: number;
};

export type PublishedProjectsOptions = {
  /**
   * Include `status: private` projects. Defaults to `false`.
   */
  includePrivate?: boolean;
};

const STATUS_RANK: Record<
  "active" | "coming-soon" | "archived" | "private",
  number
> = {
  active: 0,
  "coming-soon": 1,
  archived: 2,
  private: 3,
};

/**
 * Pure filter+sort for blog posts. Decoupled from `astro:content` so it can
 * be unit-tested with synthetic entries.
 *
 * Sort: `pubDate` desc, then `id` asc as a deterministic tiebreaker on equal
 * dates.
 */
export function filterAndSortPosts(
  entries: ReadonlyArray<CollectionEntry<"blog">>,
  opts: PublishedPostsOptions = {},
): CollectionEntry<"blog">[] {
  const includeDrafts = opts.includeDrafts === true;

  const visible = entries.filter((e) =>
    includeDrafts ? true : e.data.draft !== true,
  );

  const sorted = [...visible].sort((a, b) => {
    const da = a.data.pubDate.getTime();
    const db = b.data.pubDate.getTime();
    if (db !== da) return db - da;
    return a.id.localeCompare(b.id);
  });

  if (typeof opts.limit === "number" && opts.limit >= 0) {
    return sorted.slice(0, opts.limit);
  }
  return sorted;
}

export type PostNeighbours = {
  /**
   * The post chronologically before this one (older). Undefined for the
   * oldest post in the published set.
   */
  prev: CollectionEntry<"blog"> | undefined;
  /**
   * The post chronologically after this one (newer). Undefined for the
   * newest post.
   */
  next: CollectionEntry<"blog"> | undefined;
};

/**
 * Pure prev/next neighbour lookup over the same ordering returned by
 * `getPublishedPosts()`. The input array MUST already be the
 * `getPublishedPosts()` output (sorted `pubDate` desc, drafts excluded);
 * doing the sort here would let prev/next drift from the route ordering.
 *
 * Convention:
 *   - posts are sorted newest → oldest, so index 0 is the newest.
 *   - `next` (newer post) is the entry at `i - 1`.
 *   - `prev` (older post) is the entry at `i + 1`.
 *
 * Returns `{ prev: undefined, next: undefined }` if `slug` is not present.
 */
export function getPostNeighbours(
  posts: ReadonlyArray<CollectionEntry<"blog">>,
  slug: string,
): PostNeighbours {
  const i = posts.findIndex((p) => p.id === slug);
  if (i === -1) return { prev: undefined, next: undefined };
  return {
    prev: posts[i + 1],
    next: posts[i - 1],
  };
}

/**
 * Pure filter+sort for projects.
 *
 * Sort: `status` rank (active → archived → private if included), then `name`
 * asc as a deterministic tiebreaker.
 */
export function filterAndSortProjects(
  entries: ReadonlyArray<CollectionEntry<"projects">>,
  opts: PublishedProjectsOptions = {},
): CollectionEntry<"projects">[] {
  const includePrivate = opts.includePrivate ?? false;

  const visible = entries.filter((e) =>
    includePrivate ? true : e.data.status !== "private",
  );

  return [...visible].sort((a, b) => {
    const ra = STATUS_RANK[a.data.status as keyof typeof STATUS_RANK];
    const rb = STATUS_RANK[b.data.status as keyof typeof STATUS_RANK];
    if (ra !== rb) return ra - rb;
    return String(a.data.name).localeCompare(String(b.data.name));
  });
}
