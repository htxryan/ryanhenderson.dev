/**
 * E2 — Brutalist Design Tokens (single source of truth)
 *
 * This module is the SINGLE source for the visual identity. Three consumers
 * read from here:
 *   1. `tokens.css` — generated `:root` + `:root[data-theme="dark"]`
 *      CSS custom properties (regenerate via `pnpm gen:tokens`).
 *   2. Satori (E7) — OG image renderer cannot resolve CSS vars, so it imports
 *      this TypeScript module directly and pulls concrete hex / numeric values.
 *   3. Shiki (E4) — runs in `cssVariables` mode keyed off the `--shiki-*`
 *      surface defined here; the values in light/dark theme objects feed those
 *      variables in `tokens.css`.
 *
 * Discipline (advisory P1 #9): the count of top-level CSS custom properties
 * derived from this module is bounded to 8–12. Adding the 13th requires
 * explicit justification — see `tokenSurfaceCount` in `tests/tokens.test.ts`.
 *
 * Names are public API. Renaming a token is a breaking change to every
 * consumer (CSS, Satori, Shiki). Adding a token is cheap; removing or
 * repurposing is not.
 */

export type ThemeMode = "light" | "dark";

export type ThemePalette = {
  /** Primary text. WCAG 2.2 AA body-text contrast against `paper`. */
  ink: string;
  /** Page background. */
  paper: string;
  /** Secondary text (metadata, captions). AA against `paper`. */
  muted: string;
  /** Single accent — used for links, emphasis, signal markers. */
  accent: string;
  /** Hairline rule color (borders, dividers). */
  rule: string;
};

export type Tokens = {
  font: {
    /** Primary monospaced stack — Swiss Brutalist mono-driven typography. */
    mono: string;
    /** Secondary stack reserved for prose (E4 may opt in). */
    sans: string;
  };
  scale: {
    /** Base body size in px. Scale derives from this via `ratio`. */
    base: number;
    /** Modular scale ratio (1.25 — major third). */
    ratio: number;
  };
  space: {
    /** 8px base unit. All vertical/horizontal rhythm is a multiple. */
    unit: number;
  };
  rule: {
    /** Hairline border weight (px). */
    hairline: number;
  };
  measure: {
    /** Reading measure in `ch`. Spec §4.2 U-6 mandates 60–75ch. */
    ch: number;
  };
  light: ThemePalette;
  dark: ThemePalette;
};

/**
 * Concrete token values. Hex strings (no CSS vars) — Satori cannot resolve
 * CSS custom properties.
 *
 * Light palette (soft off-white canvas, not pure white):
 *   ink     #111111 on #f5f5f5 = 17.3:1   (AAA)
 *   muted   #4a4a4a on #f5f5f5 =  8.1:1   (AAA)
 *   accent  #1a5fcc on #f5f5f5 =  5.4:1   (AA normal — azul blue)
 *   rule    #111111 on #f5f5f5 = 17.3:1   (structural, used at 1px)
 *
 * Dark palette (GitHub "dark dimmed" — soft canvas, not pure black):
 *   ink     #cdd9e5 on #22272e = 10.3:1   (AAA)
 *   muted   #909dab on #22272e =  5.4:1   (AA)
 *   accent  #5c9ce6 on #22272e =  5.2:1   (AA — lighter azul, same hue family)
 *   rule    #768390 on #22272e =  3.8:1   (structural, used at 1px — soft border)
 *
 * Why two accent values: a single blue can't satisfy AA body-text contrast
 * (4.5:1) against BOTH paper colors — the required luminance ranges don't
 * overlap. Same approach the previous red palette used.
 *
 * Contrast ratios are verified by `tests/tokens.test.ts` — any change to a
 * color must keep the AA threshold for body text (4.5:1) and link/accent (3:1
 * for non-text, 4.5:1 if used as text color).
 */
export const tokens: Tokens = {
  font: {
    mono: '"JetBrains Mono", "IBM Plex Mono", "SF Mono", ui-monospace, "Cascadia Code", "Roboto Mono", Menlo, Consolas, monospace',
    sans: 'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  },
  scale: {
    base: 16,
    ratio: 1.25,
  },
  space: {
    unit: 8,
  },
  rule: {
    hairline: 1,
  },
  measure: {
    ch: 70,
  },
  light: {
    ink: "#111111",
    paper: "#f5f5f5",
    muted: "#4a4a4a",
    accent: "#1a5fcc",
    rule: "#111111",
  },
  dark: {
    ink: "#cdd9e5",
    paper: "#22272e",
    muted: "#909dab",
    accent: "#5c9ce6",
    rule: "#768390",
  },
};

/**
 * Top-level CSS custom properties this module surfaces on `:root`.
 *
 * Length must stay in [8, 12]. Theme-variant palette properties (--ink,
 * --paper, --muted, --accent, --rule-color) count once each — they swap
 * value under `[data-theme="dark"]` but occupy a single name.
 */
export const tokenSurfaceNames = [
  "--font-mono",
  "--font-sans",
  "--scale-base",
  "--space-unit",
  "--rule-hairline",
  "--measure",
  "--ink",
  "--paper",
  "--muted",
  "--accent",
  "--rule-color",
] as const;

/**
 * Shiki `cssVariables` surface (advisory P2 #15).
 *
 * E4 will configure Shiki to emit class-less HTML using these CSS variables.
 * Reserved here so E4 cannot drift the names. Values resolve from the active
 * theme palette via `tokens.css`.
 *
 * These do NOT count toward the 8–12 token surface — they are derived
 * variables routed through the palette.
 */
export const shikiSurfaceNames = [
  "--shiki-fg",
  "--shiki-bg",
  "--shiki-token-keyword",
  "--shiki-token-string",
  "--shiki-token-comment",
  "--shiki-token-function",
  "--shiki-token-constant",
  "--shiki-token-punctuation",
] as const;

/**
 * Generate the CSS file content from the token object.
 *
 * Round-trip invariant: the file at `src/styles/tokens.css` MUST equal the
 * output of this function. `tests/tokens.test.ts` enforces it; the
 * regeneration script `scripts/generate-tokens-css.mjs` writes it.
 */
export function tokensToCss(): string {
  const t = tokens;
  const lines: string[] = [];

  lines.push("/* GENERATED FROM src/styles/tokens.ts — DO NOT HAND-EDIT. */");
  lines.push("/* Run `pnpm gen:tokens` to regenerate after changing tokens.ts. */");
  lines.push("");
  lines.push(":root {");
  lines.push(`  --font-mono: ${t.font.mono};`);
  lines.push(`  --font-sans: ${t.font.sans};`);
  lines.push(`  --scale-base: ${t.scale.base}px;`);
  lines.push(`  --space-unit: ${t.space.unit}px;`);
  lines.push(`  --rule-hairline: ${t.rule.hairline}px;`);
  lines.push(`  --measure: ${t.measure.ch}ch;`);
  lines.push("");
  lines.push("  /* Light is the default; --ink/--paper/--muted/--accent/--rule-color");
  lines.push("     are overridden under [data-theme=\"dark\"] below. */");
  lines.push(`  --ink: ${t.light.ink};`);
  lines.push(`  --paper: ${t.light.paper};`);
  lines.push(`  --muted: ${t.light.muted};`);
  lines.push(`  --accent: ${t.light.accent};`);
  lines.push(`  --rule-color: ${t.light.rule};`);
  lines.push("");
  lines.push("  /* Shiki cssVariables surface (E4 contract). Reserved by E2. */");
  lines.push("  --shiki-fg: var(--ink);");
  lines.push("  --shiki-bg: var(--paper);");
  lines.push(`  --shiki-token-keyword: ${t.light.accent};`);
  lines.push(`  --shiki-token-string: ${t.light.muted};`);
  lines.push(`  --shiki-token-comment: ${t.light.muted};`);
  lines.push(`  --shiki-token-function: ${t.light.ink};`);
  lines.push(`  --shiki-token-constant: ${t.light.accent};`);
  lines.push(`  --shiki-token-punctuation: ${t.light.muted};`);
  lines.push("}");
  lines.push("");
  lines.push(':root[data-theme="dark"] {');
  lines.push(`  --ink: ${t.dark.ink};`);
  lines.push(`  --paper: ${t.dark.paper};`);
  lines.push(`  --muted: ${t.dark.muted};`);
  lines.push(`  --accent: ${t.dark.accent};`);
  lines.push(`  --rule-color: ${t.dark.rule};`);
  lines.push("");
  lines.push(`  --shiki-token-keyword: ${t.dark.accent};`);
  lines.push(`  --shiki-token-string: ${t.dark.muted};`);
  lines.push(`  --shiki-token-comment: ${t.dark.muted};`);
  lines.push(`  --shiki-token-function: ${t.dark.ink};`);
  lines.push(`  --shiki-token-constant: ${t.dark.accent};`);
  lines.push(`  --shiki-token-punctuation: ${t.dark.muted};`);
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}
