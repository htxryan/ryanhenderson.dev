import { getCollection, type CollectionEntry } from "astro:content";
import {
  filterAndSortPosts,
  filterAndSortProjects,
  type PublishedPostsOptions,
  type PublishedProjectsOptions,
} from "./content-pure";

/**
 * SINGLE FILTER AUTHORITY — DO NOT BYPASS.
 *
 * `getCollection("blog")` and `getCollection("projects")` MUST NOT be called
 * outside this module. All routes, RSS feeds, sitemap, OG image generators,
 * tag archives, and search indexers MUST consume content via the helpers
 * exported here.
 *
 * Why: drafts and `status: private` projects must be filtered in exactly one
 * place. Splitting the filter logic across consumers leaks drafts into RSS
 * feeds and sitemaps. This is STPA control-action B1 / advisory P1 #4.
 *
 * Enforcement: `pnpm check:content-source` (scripts/check-content-helpers.mjs)
 * fails the build if it finds direct `getCollection("blog"|"projects")` calls
 * outside this file.
 *
 * The pure sort/filter logic lives in `./content-pure.ts` so it can be
 * unit-tested without booting the Astro content layer.
 */

export type { PublishedPostsOptions, PublishedProjectsOptions };

/**
 * Master switch for the blog. While `false`, `getPublishedPosts()` returns
 * an empty array, which removes posts from the tags archive, search index,
 * and OG enumeration without touching their consumer code. The route files
 * themselves live under `src/pages/_blog/` (Astro skips `_`-prefixed dirs)
 * so /posts/, /feed.xml, /atom.xml are not built. To restore the blog:
 * flip this to `true` AND move `src/pages/_blog/*` back to their original
 * locations (see git history for the move).
 */
export const BLOG_VISIBLE = false;

/**
 * Returns published blog posts in stable order.
 *
 * Sort: `pubDate` desc, with `id` (slug) asc as tiebreaker for deterministic
 * order on equal dates.
 *
 * Returns [] when `BLOG_VISIBLE` is false — the rest of the site behaves as
 * if no posts exist (empty tag pages, no post OG cards, no post sitemap
 * entries, no post links from search).
 */
export async function getPublishedPosts(
  opts: PublishedPostsOptions = {},
): Promise<CollectionEntry<"blog">[]> {
  if (!BLOG_VISIBLE) return [];
  const includeDrafts = opts.includeDrafts ?? import.meta.env.DEV;
  const all = await getCollection("blog");
  return filterAndSortPosts(all, { ...opts, includeDrafts });
}

/**
 * Returns published portfolio projects in stable order.
 *
 * Sort: `status` rank (active → archived → private if included), with `name`
 * asc as tiebreaker.
 */
export async function getPublishedProjects(
  opts: PublishedProjectsOptions = {},
): Promise<CollectionEntry<"projects">[]> {
  const all = await getCollection("projects");
  return filterAndSortProjects(all, opts);
}
