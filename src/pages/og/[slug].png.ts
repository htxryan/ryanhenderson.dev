/**
 * E7 — Per-slug OG card endpoint.
 *
 * Astro emits one PNG per published post AND per visible project under
 * `/og/<slug>.png`. Path enumeration consumes the SAME `getPublishedPosts`
 * / `getPublishedProjects` helpers as the human-facing routes (C-2 single
 * filter authority — drafts and `private` projects never get a card).
 *
 * Slug collisions across collections: posts and projects share the
 * `/og/<slug>/` namespace by spec (C-10). If two collections produce the
 * same slug, the post wins (because we add posts first); a build-time log
 * flags the collision so the author can rename one. This is acceptable for
 * v1 — adding namespaces would deviate from the C-10 contract.
 *
 * Render-failure policy (spec): a single slug whose Satori render throws
 * MUST fall back to the default card; the build does not abort.
 */
import type { APIRoute } from "astro";
import { getPublishedPosts, getPublishedProjects } from "~/lib/content";
import { renderCardPng, renderFallbackPng } from "../../../scripts/og/render";
import type { CardInput } from "../../../scripts/og/template";

interface OgPathProps {
  card: CardInput;
}

export async function getStaticPaths() {
  const [posts, projects] = await Promise.all([
    getPublishedPosts(),
    getPublishedProjects(),
  ]);

  const seen = new Set<string>();
  const out: { params: { slug: string }; props: OgPathProps }[] = [];

  for (const post of posts) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    out.push({
      params: { slug: post.id },
      props: {
        card: {
          kind: "writing",
          title: post.data.title,
          kicker: post.data.summary,
          mode: "light",
        },
      },
    });
  }

  for (const project of projects) {
    if (seen.has(project.id)) {
      console.warn(
        `[og] slug collision: project '${project.id}' shares the OG namespace with a post — keeping the post card.`,
      );
      continue;
    }
    seen.add(project.id);
    out.push({
      params: { slug: project.id },
      props: {
        card: {
          kind: "work",
          title: project.data.name,
          kicker: project.data.oneLiner,
          mode: "light",
        },
      },
    });
  }

  return out;
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
