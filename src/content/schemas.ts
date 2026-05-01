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
 *
 * Tag normalization: `tags` are validated as slug-safe (alphanumeric + hyphens),
 * accepted in any case, and emitted lowercase. This is the single source of
 * truth — link-generation sites can interpolate `tag` directly without any
 * `.toLowerCase()` calls and trust that `/tags/<tag>/` resolves. A frontmatter
 * tag like `TypeScript` becomes `typescript`; a tag with `.`/`+`/whitespace
 * fails parse loudly so we never emit malformed routes.
 */

const tagSchema = z
  .array(
    z
      .string()
      .min(1)
      .regex(
        /^[A-Za-z0-9][A-Za-z0-9-]*$/,
        "tag must be slug-safe: alphanumeric and hyphens only",
      ),
  )
  .default([])
  .transform((tags) => tags.map((t) => t.toLowerCase()));

export const blogSchema = z
  .object({
    title: z.string().min(1),
    pubDate: z.coerce.date(),
    summary: z.string().min(1).max(200),
    tags: tagSchema,
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
    tags: tagSchema,
    pubDate: z.coerce.date().optional(),
  })
  .strict();

export type BlogFrontmatter = z.infer<typeof blogSchema>;
export type ProjectFrontmatter = z.infer<typeof projectSchema>;
