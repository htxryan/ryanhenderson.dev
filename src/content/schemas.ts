import { z } from "astro/zod";

/**
 * Pure zod schemas for content collections.
 *
 * Extracted from `config.ts` so they can be unit-tested without booting the
 * Astro content layer. `config.ts` imports these and wires them into
 * `defineCollection` with the appropriate loader.
 *
 * `.strict()` rejects unknown frontmatter keys — silent typos are the failure
 * mode that bites. The schemas are APPEND-ONLY: never repurpose a key name
 * once content has been authored against it.
 */

export const blogSchema = z
  .object({
    title: z.string().min(1),
    pubDate: z.coerce.date(),
    summary: z.string().min(1).max(200),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    updated: z.coerce.date().optional(),
    canonicalUrl: z.string().url().optional(),
  })
  .strict();

export const projectSchema = z
  .object({
    name: z.string().min(1),
    oneLiner: z.string().min(1).max(140),
    status: z.enum(["active", "archived", "private"]),
    marketingUrl: z.string().url(),
    repoUrl: z.string().url().optional(),
    tags: z.array(z.string()).default([]),
    pubDate: z.coerce.date().optional(),
  })
  .strict();

export type BlogFrontmatter = z.infer<typeof blogSchema>;
export type ProjectFrontmatter = z.infer<typeof projectSchema>;
