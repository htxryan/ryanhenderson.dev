/**
 * E4 — Reading metrics (pure).
 *
 * Word-count = whitespace-separated tokens of the post's MDX body source.
 * Reading time = ceil(words / WPM). 200 wpm is the spec default (U-4).
 *
 * Counting the raw MDX source over-counts slightly because markdown syntax
 * (`#`, `*`, fences) is included as tokens, but it's deterministic and
 * cheap. Stripping syntax would require parsing MDX — out of scope for v1.
 *
 * `Math.max(1, …)` keeps the displayed reading time honest for very short
 * posts: "less than a minute" reads worse than "1 min" on the surface.
 */

export const WORDS_PER_MINUTE = 200;

export type ReadingMetrics = {
  /** Whitespace-separated token count of the input body. */
  words: number;
  /** Estimated read time in minutes, never less than 1. */
  minutes: number;
};

export function readingMetrics(
  body: string,
  wpm: number = WORDS_PER_MINUTE,
): ReadingMetrics {
  const trimmed = body.trim();
  const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;
  const minutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / wpm));
  return { words, minutes };
}
