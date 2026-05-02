import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { blogSchema, projectSchema } from "./content/schemas";

/**
 * Slug rule (enforced via filename convention by Astro):
 *   slug = filename without .mdx, must match /^[a-z0-9-]+$/
 *
 * Schemas live in `./schemas.ts` so they can be unit-tested without booting
 * the content layer. The schemas are APPEND-ONLY.
 */

const blog = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/blog" }),
  schema: blogSchema,
});

const projects = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/projects" }),
  schema: projectSchema,
});

export const collections = { blog, projects };
