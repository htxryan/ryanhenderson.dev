import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { getContainerRenderer as getMDXRenderer } from "@astrojs/mdx";
import { loadRenderers } from "astro:container";
import { render } from "astro:content";
import { getPublishedPosts } from "~/lib/content";
import { Callout, Figure, Footnote } from "~/components/mdx";

/**
 * E6 — RSS 2.0 feed.
 *
 * Last 20 non-draft posts, full rendered HTML body. Built via `@astrojs/rss`.
 *
 * Single filter authority (C-2 / advisory P1 #4): consumes `getPublishedPosts()`
 * — never the raw collection loader. Drafts must be filtered in exactly one
 * place; the `pnpm check:content-source` build gate enforces it.
 *
 * Full-content rendering uses Astro's experimental Container API plus the
 * MDX container renderer so post bodies (including Shiki code blocks and
 * the Callout/Figure/Footnote MDX components) materialize as HTML strings
 * inside the `<content:encoded>` CDATA.
 */
export async function GET(context: APIContext) {
  const posts = await getPublishedPosts({ limit: 20 });

  const renderers = await loadRenderers([getMDXRenderer()]);
  const container = await AstroContainer.create({ renderers });

  const items = await Promise.all(
    posts.map(async (post) => {
      const { Content } = await render(post);
      const content = await container.renderToString(Content, {
        props: { components: { Callout, Figure, Footnote } },
      });
      return {
        title: post.data.title,
        pubDate: post.data.pubDate,
        description: post.data.summary,
        link: `/posts/${post.id}/`,
        content,
        categories: post.data.tags,
      };
    }),
  );

  return rss({
    title: "ryanhenderson.dev",
    description:
      "Ryan Henderson — consulting, software, and the work. Long-form writing.",
    site: context.site ?? "https://ryanhenderson.dev/",
    items,
    customData: "<language>en-us</language>",
    stylesheet: false,
  });
}
