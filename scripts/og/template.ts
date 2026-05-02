/**
 * E7 — Satori OG card template (single brutalist layout, posts + projects).
 *
 * Returns a Satori-compatible element tree (plain object, no JSX) so this
 * file runs unmodified under Astro's Vite SSR loader without a JSX
 * transform. Concrete colors come from `tokens.ts` (Satori cannot resolve
 * CSS variables — see contract C-10 / advisory P1 #5).
 */
import { tokens } from "../../src/styles/tokens.ts";

type Mode = "light" | "dark";

export type CardKind = "writing" | "work" | "site";

export interface CardInput {
  kind: CardKind;
  title: string;
  /** Short caption shown under the title. Posts: summary; projects: oneLiner. */
  kicker: string;
  /** Visual mode. Default light (ink-on-paper) for social-share consistency. */
  mode?: Mode;
}

const EYEBROW: Record<CardKind, string> = {
  writing: "writing",
  work: "work",
  site: "ryanhenderson.dev",
};

type Node = {
  type: string;
  props: Record<string, unknown> & {
    style?: Record<string, unknown>;
    children?: unknown;
  };
};

function h(
  type: string,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): Node {
  const flat = children.flat().filter((c) => c !== null && c !== undefined && c !== false);
  // Satori 0.26 treats `children: []` as multi-child and demands an explicit
  // `display`. Omit the `children` key entirely when there are none so leaf
  // divs (hairline rules) stay valid without forcing a display value.
  const out: Record<string, unknown> = { ...(props ?? {}) };
  if (flat.length === 1) out.children = flat[0];
  else if (flat.length > 1) out.children = flat;
  return { type, props: out as Node["props"] };
}

/**
 * Wrap title text to a maximum number of lines without overflowing the
 * 1200x630 frame. Satori clamps wrapped text reasonably with `display: flex`
 * + `lineClamp`, but we still hard-cap title length so a runaway frontmatter
 * value cannot blow the layout.
 */
function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

/**
 * Build the Satori element tree for a single card.
 *
 * Layout:
 *   - 1200×630 canvas, `paper` background, `ink` text
 *   - 60px outer padding (matches the site's brutalist hairline rule rhythm)
 *   - eyebrow row: kind label (writing/work) + wordmark (ryanhenderson.dev)
 *     separated by a spacer; both in mono regular
 *   - hairline rule (1px ink) under the eyebrow
 *   - title block (mono bold, ~64–80px, 3-line clamp)
 *   - kicker block (mono regular, ~28px, muted color, 2-line clamp)
 *   - footer hairline + tag/section line
 */
export function buildCardTree(input: CardInput): Node {
  const mode: Mode = input.mode ?? "light";
  const palette = tokens[mode];

  const title = clamp(input.title, 110);
  const kicker = clamp(input.kicker, 200);
  const kindLabel = EYEBROW[input.kind];
  // Suppress the wordmark when the eyebrow already IS the wordmark (the
  // `site` fallback case). Otherwise the same string appears twice on the
  // top row.
  const showWordmark = input.kind !== "site";

  const fontMono = "JetBrainsMono";

  return h(
    "div",
    {
      style: {
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: palette.paper,
        color: palette.ink,
        fontFamily: fontMono,
        padding: "60px",
        boxSizing: "border-box",
      },
    },
    // Eyebrow row: kind label + wordmark
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "22px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: palette.muted,
        },
      },
      h("div", { style: { display: "flex" } }, kindLabel),
      showWordmark
        ? h("div", { style: { display: "flex" } }, "ryanhenderson.dev")
        : null,
    ),
    // Hairline divider under eyebrow
    h("div", {
      style: {
        marginTop: "20px",
        height: "1px",
        width: "100%",
        backgroundColor: palette.rule,
      },
    }),
    // Title — flex-grow so it absorbs the middle of the card
    h(
      "div",
      {
        style: {
          display: "flex",
          flexGrow: 1,
          flexDirection: "column",
          justifyContent: "center",
          paddingTop: "40px",
          paddingBottom: "20px",
        },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            fontWeight: 700,
            fontSize: title.length > 60 ? "60px" : title.length > 40 ? "72px" : "84px",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: palette.ink,
          },
        },
        title,
      ),
    ),
    // Footer rule
    h("div", {
      style: {
        height: "1px",
        width: "100%",
        backgroundColor: palette.rule,
      },
    }),
    // Kicker (description) under the rule, accent-tinted left marker
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          marginTop: "20px",
          fontSize: "26px",
          lineHeight: 1.4,
          color: palette.muted,
        },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            color: palette.accent,
            marginRight: "16px",
            fontWeight: 700,
          },
        },
        // ASCII '>' (not '→'): the vendored JetBrains Mono Latin subset
        // ships ASCII glyphs only, so any non-Latin codepoint renders as
        // tofu. Mono '>' fits the brutalist palette and stays in-subset.
        ">",
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexGrow: 1,
            flexShrink: 1,
          },
        },
        kicker,
      ),
    ),
  );
}
