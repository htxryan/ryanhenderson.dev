import { describe, expect, test } from "vitest";
import { readingMetrics, WORDS_PER_MINUTE } from "../src/lib/reading";

describe("readingMetrics", () => {
  test("counts whitespace-separated tokens", () => {
    expect(readingMetrics("one two three").words).toBe(3);
  });

  test("collapses multiple whitespace as a single separator", () => {
    expect(readingMetrics("one   two\t\nthree").words).toBe(3);
  });

  test("handles leading/trailing whitespace", () => {
    expect(readingMetrics("  hello world  ").words).toBe(2);
  });

  test("empty string -> 0 words and 0 minutes", () => {
    expect(readingMetrics("")).toEqual({ words: 0, minutes: 0 });
    expect(readingMetrics("   ")).toEqual({ words: 0, minutes: 0 });
  });

  test("rounds reading time UP (ceil) so partial minutes are not lost", () => {
    // 250 words at 200 wpm = 1.25 min → 2 minutes (ceil).
    const body = Array(250).fill("word").join(" ");
    expect(readingMetrics(body).minutes).toBe(2);
  });

  test("never reports less than 1 minute for non-empty content", () => {
    expect(readingMetrics("just a few words").minutes).toBe(1);
  });

  test("uses 200 wpm by default", () => {
    expect(WORDS_PER_MINUTE).toBe(200);
    const body = Array(200).fill("w").join(" ");
    expect(readingMetrics(body).minutes).toBe(1);
  });

  test("custom wpm threshold is respected", () => {
    const body = Array(300).fill("w").join(" ");
    expect(readingMetrics(body, 100).minutes).toBe(3);
  });
});
