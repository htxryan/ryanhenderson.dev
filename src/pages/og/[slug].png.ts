/**
 * Per-slug OG card endpoint.
 *
 * Currently emits NO per-slug cards. Both consumers are turned off:
 *   - blog post pages live under src/pages/_blog/ (Astro skips that dir)
 *   - project detail pages live under src/pages/work/_[slug].astro
 *     (underscore-prefix excludes them)
 * Without a `/posts/<slug>/` or `/work/<slug>/` page to host the meta tag,
 * a per-slug card has no consumer; the shell routes (home/about/work-index/
 * 404/search) reference `/og-default.png` directly.
 *
 * To re-enable per-slug cards: restore the enumeration over
 * `getPublishedPosts()` and/or `getPublishedProjects()` here, AND restore
 * the matching detail-page routes.
 *
 * Render-failure policy (spec): a single slug whose Satori render throws
 * MUST fall back to the default card; the build does not abort.
 */
import type { APIRoute } from "astro";
import { renderCardPng, renderFallbackPng } from "../../../scripts/og/render";
import type { CardInput } from "../../../scripts/og/template";

interface OgPathProps {
  card: CardInput;
}

export async function getStaticPaths() {
  return [] as { params: { slug: string }; props: OgPathProps }[];
}

export const GET: APIRoute = async ({ props, params }) => {
  const { card } = props as unknown as OgPathProps;
  let bytes: Buffer;
  try {
    bytes = await renderCardPng(card);
  } catch (err) {
    console.error(
      `[og] render failed for '${params.slug}', falling back to og-default:`,
      err,
    );
    bytes = await renderFallbackPng();
  }
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
};
