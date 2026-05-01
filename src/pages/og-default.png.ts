/**
 * E7 — Static fallback OG card (`/og-default.png`).
 *
 * Produced by the same Satori pipeline as per-slug cards but with a
 * neutral title/kicker so it can stand in for any route whose dedicated
 * render fails (per-slug try/catch in `og/[slug].png.ts`) and as the meta
 * value for any future routes that don't have a dedicated card.
 *
 * If THIS render fails the build aborts — losing the default would leave
 * the per-slug fallback path with nothing to fall back to.
 */
import type { APIRoute } from "astro";
import { renderFallbackPng } from "../../scripts/og/render";

export const prerender = true;

export const GET: APIRoute = async () => {
  const bytes = await renderFallbackPng();
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
};
