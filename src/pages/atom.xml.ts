import type { APIContext } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { getContainerRenderer as getMDXRenderer } from "@astrojs/mdx";
import { loadRenderers } from "astro:container";
import { render } from "astro:content";
import { getPublishedPosts } from "~/lib/content";
import { Callout, Figure, Footnote } from "~/components/mdx";

/**
 * E6 — Atom 1.0 feed (hand-rolled).
 *
 * `@astrojs/rss` does not emit Atom natively, and the user has chosen to ship
 * Atom alongside RSS despite advisor #6's "drop one" recommendation. Keep this
 * template minimal — do NOT extract a "feed abstraction" shared with feed.xml.
 * One rendering function, one route, one source of truth for the Atom shape.
 *
 * Single filter authority (C-2): consumes `getPublishedPosts()`.
 */

const SITE_TITLE = "ryanhenderson.dev";
const SITE_DESCRIPTION =
  "Ryan Henderson — consulting, software, and the work. Long-form writing.";
const AUTHOR_NAME = "Ryan Henderson";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cdata(s: string): string {
  // Atom <content type="html"> takes HTML inside CDATA. Escape any nested
  // `]]>` sequence the rendered body might contain.
  return `<![CDATA[${s.replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
}

export async function GET(context: APIContext) {
  const site = (context.site ?? new URL("https://ryanhenderson.dev/")).toString();
  const posts = await getPublishedPosts({ limit: 20 });

  const renderers = await loadRenderers([getMDXRenderer()]);
  const container = await AstroContainer.create({ renderers });

  const updated =
    posts.length > 0
      ? new Date(
          Math.max(
            ...posts.map((p) =>
              (p.data.updated ?? p.data.pubDate).getTime(),
            ),
          ),
        ).toISOString()
      : new Date().toISOString();

  const entries = await Promise.all(
    posts.map(async (post) => {
      const { Content } = await render(post);
      const content = await container.renderToString(Content, {
        props: { components: { Callout, Figure, Footnote } },
      });
      const url = new URL(`/posts/${post.id}/`, site).toString();
      const urlAttr = escapeXml(url);
      const tagXml = post.data.tags
        .map(
          (t: string) => `    <category term="${escapeXml(t)}" />`,
        )
        .join("\n");
      return `  <entry>
    <title>${escapeXml(post.data.title)}</title>
    <id>${urlAttr}</id>
    <link rel="alternate" type="text/html" href="${urlAttr}" />
    <updated>${(post.data.updated ?? post.data.pubDate).toISOString()}</updated>
    <published>${post.data.pubDate.toISOString()}</published>
    <summary>${escapeXml(post.data.summary)}</summary>
${tagXml ? tagXml + "\n" : ""}    <content type="html">${cdata(content)}</content>
  </entry>`;
    }),
  );

  const siteAttr = escapeXml(site);
  const selfAttr = escapeXml(new URL("/atom.xml", site).toString());
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(SITE_TITLE)}</title>
  <subtitle>${escapeXml(SITE_DESCRIPTION)}</subtitle>
  <id>${siteAttr}</id>
  <link rel="alternate" type="text/html" href="${siteAttr}" />
  <link rel="self" type="application/atom+xml" href="${selfAttr}" />
  <updated>${updated}</updated>
  <author>
    <name>${escapeXml(AUTHOR_NAME)}</name>
  </author>
${entries.join("\n")}
</feed>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
    },
  });
}
