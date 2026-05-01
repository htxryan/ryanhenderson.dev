/**
 * E4 — Reading metrics (pure).
 *
 * Word-count = whitespace-separated tokens of the post's MDX body, after
 * stripping JSX/MDX component tags. Reading time = ceil(words / WPM).
 * 200 wpm is the spec default (U-4).
 *
 * The strip step removes opening and closing component tags
 * (`<Callout …>`, `</Callout>`) before counting. Without it, a heavily
 * componentized post inflates its word count by a few "words" per
 * component invocation. Markdown syntax tokens (`#`, `*`, fences) are
 * NOT stripped — those round to noise relative to running prose.
 *
 * `Math.max(1, …)` keeps the displayed reading time honest for very short
 * posts: "less than a minute" reads worse than "1 min" on the surface.
 */

export const WORDS_PER_MINUTE = 200;

export type ReadingMetrics = {
  /** Whitespace-separated token count of the input body. */
  words: number;
  /** Estimated read time in minutes, never less than 1 (unless 0 words). */
  minutes: number;
};

// Matches HTML/MDX/JSX element opening or closing tags. Component tags in
// MDX must start with an ASCII letter; the trailing `[^>]*` swallows
// attributes including JSX expressions like `prop={…}` (no `>` allowed
// inside JSX braces by MDX's own grammar, so this is safe enough for the
// word-count use case — it's not an HTML parser).
const TAG_RE = /<\/?[A-Za-z][\w.-]*[^>]*>/g;

export function readingMetrics(
  body: string,
  wpm: number = WORDS_PER_MINUTE,
): ReadingMetrics {
  const cleaned = body.replace(TAG_RE, " ").trim();
  const words = cleaned === "" ? 0 : cleaned.split(/\s+/).length;
  const minutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / wpm));
  return { words, minutes };
}
