import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  shikiSurfaceNames,
  tokens,
  tokenSurfaceNames,
  tokensToCss,
} from "../src/styles/tokens";

/**
 * E2 invariants. These tests own the contracts the rest of the system
 * depends on (Satori in E7, Shiki in E4, BaseLayout in E3).
 */

const repoRoot = resolve(__dirname, "..");
const tokensCssPath = resolve(repoRoot, "src/styles/tokens.css");

// -------- helpers (WCAG contrast) --------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  if (h.length !== 6) throw new Error(`expected 6-digit hex, got ${hex}`);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function relLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const lin = (v: number): number =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(a: string, b: string): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// -------- token surface --------

describe("token surface (advisory P1 #9)", () => {
  test("top-level token count is between 8 and 12", () => {
    expect(tokenSurfaceNames.length).toBeGreaterThanOrEqual(8);
    expect(tokenSurfaceNames.length).toBeLessThanOrEqual(12);
  });

  test("every surface name is unique", () => {
    const set = new Set(tokenSurfaceNames);
    expect(set.size).toBe(tokenSurfaceNames.length);
  });

  test("every surface name appears in tokens.css", () => {
    const css = readFileSync(tokensCssPath, "utf8");
    for (const name of tokenSurfaceNames) {
      expect(css, `expected ${name} in tokens.css`).toContain(name);
    }
  });

  test("Shiki cssVariables surface is reserved", () => {
    expect(shikiSurfaceNames).toContain("--shiki-fg");
    expect(shikiSurfaceNames).toContain("--shiki-bg");
    expect(shikiSurfaceNames.length).toBeGreaterThanOrEqual(2);
    const css = readFileSync(tokensCssPath, "utf8");
    for (const name of shikiSurfaceNames) {
      expect(css, `expected ${name} in tokens.css`).toContain(name);
    }
  });
});

// -------- generated CSS round-trip --------

describe("tokens.css drift", () => {
  test("file on disk equals tokensToCss() output (run `pnpm gen:tokens` to fix)", () => {
    const generated = tokensToCss();
    const onDisk = readFileSync(tokensCssPath, "utf8");
    expect(onDisk).toBe(generated);
  });
});

// -------- WCAG 2.2 AA --------

describe("WCAG 2.2 AA contrast (U-16)", () => {
  for (const mode of ["light", "dark"] as const) {
    describe(`${mode} mode`, () => {
      const p = tokens[mode];

      test("ink on paper meets AAA (>=7:1) for body text", () => {
        const r = contrastRatio(p.ink, p.paper);
        expect(r).toBeGreaterThanOrEqual(7);
      });

      test("muted on paper meets AA (>=4.5:1) for body text", () => {
        const r = contrastRatio(p.muted, p.paper);
        expect(r).toBeGreaterThanOrEqual(4.5);
      });

      test("accent on paper meets AA (>=4.5:1) — used as link color", () => {
        const r = contrastRatio(p.accent, p.paper);
        expect(r).toBeGreaterThanOrEqual(4.5);
      });

      test("rule on paper meets non-text 3:1 — visible structural element", () => {
        const r = contrastRatio(p.rule, p.paper);
        expect(r).toBeGreaterThanOrEqual(3);
      });
    });
  }
});

// -------- shape sanity --------

describe("token shape", () => {
  test("font stacks contain a monospace fallback", () => {
    expect(tokens.font.mono.toLowerCase()).toContain("monospace");
    expect(tokens.font.sans.toLowerCase()).toContain("sans-serif");
  });

  test("scale.base is a positive number of pixels", () => {
    expect(tokens.scale.base).toBeGreaterThan(0);
    expect(Number.isFinite(tokens.scale.base)).toBe(true);
  });

  test("scale.ratio is in a sensible modular range (1.05–2.0)", () => {
    expect(tokens.scale.ratio).toBeGreaterThanOrEqual(1.05);
    expect(tokens.scale.ratio).toBeLessThanOrEqual(2.0);
  });

  test("space.unit is the 8px Brutalist base unit", () => {
    expect(tokens.space.unit).toBe(8);
  });

  test("measure.ch is within the 60–75ch reading window (U-6)", () => {
    expect(tokens.measure.ch).toBeGreaterThanOrEqual(60);
    expect(tokens.measure.ch).toBeLessThanOrEqual(75);
  });

  test("rule.hairline is a positive integer pixel weight", () => {
    expect(tokens.rule.hairline).toBeGreaterThan(0);
    expect(Number.isInteger(tokens.rule.hairline)).toBe(true);
  });

  test("every palette field is a 6-digit hex (Satori-friendly, no CSS vars)", () => {
    for (const mode of ["light", "dark"] as const) {
      const p = tokens[mode];
      for (const key of ["ink", "paper", "muted", "accent", "rule"] as const) {
        expect(p[key], `${mode}.${key}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });
});
