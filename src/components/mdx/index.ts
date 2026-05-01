/**
 * MDX component registry. These shells are intentionally minimal in E1; visual
 * treatment is owned by E2 (Brutalist Design System) and E4 (Reading Experience).
 *
 * MDX files import these via:
 *   import { Callout, Figure, Footnote } from "~/components/mdx";
 *
 * Or the post layout (E4) registers them globally for MDX via the `components`
 * prop on `<Content />` so authors can write <Callout> without an import.
 */
export { default as Callout } from "./Callout.astro";
export { default as Figure } from "./Figure.astro";
export { default as Footnote } from "./Footnote.astro";
