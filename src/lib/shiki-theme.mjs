/**
 * E4 — Brutalist Shiki theme bound to E2 tokens via CSS variables.
 *
 * Single theme, NOT a light/dark theme pair. Token-level colors resolve from
 * the `--shiki-*` CSS custom properties declared in `src/styles/tokens.ts`
 * (E2 reserved this surface; see `shikiSurfaceNames`). Light/dark variants
 * are driven by `:root[data-theme="dark"]` swapping the underlying values —
 * Shiki itself runs once at build time.
 *
 * Why this shape (advisory P2 #15):
 *   - One Shiki invocation per build (no second theme bundle).
 *   - Color values are passed as `var(--…)` strings; Shiki emits them
 *     verbatim into inline `style="color:var(--…)"` attributes on each
 *     token <span>. The cascade does the theme switch with zero JS.
 *
 * Mapping (token → palette role, see `tokens.ts`):
 *   keyword     → accent (visual emphasis on control flow / declarations)
 *   string      → muted   (dim — strings are noise unless inspected)
 *   comment     → muted   (italic — non-essential by definition)
 *   function    → ink     (the subject of most code; full contrast)
 *   constant    → accent  (numeric / boolean / language constants)
 *   punctuation → muted   (structural, not semantic)
 *
 * The theme is exported from a `.mjs` file so `astro.config.mjs` can import
 * it without a transpile step. The shape is consumed by Shiki via
 * `markdown.shikiConfig.theme`.
 */
export const SHIKI_THEME_NAME = "brutalist-css-vars";

export const cssVariablesTheme = {
  name: SHIKI_THEME_NAME,
  // `type: "css"` is informational only; Shiki uses `fg`/`bg` to render.
  type: "css",
  fg: "var(--shiki-fg)",
  bg: "var(--shiki-bg)",
  settings: [
    {
      scope: [
        "keyword",
        "keyword.control",
        "keyword.operator.expression",
        "storage",
        "storage.type",
        "storage.modifier",
        "variable.language",
      ],
      settings: { foreground: "var(--shiki-token-keyword)" },
    },
    {
      scope: [
        "string",
        "string.quoted",
        "string.template",
        "punctuation.definition.string",
      ],
      settings: { foreground: "var(--shiki-token-string)" },
    },
    {
      scope: [
        "comment",
        "punctuation.definition.comment",
        "string.comment",
      ],
      settings: {
        foreground: "var(--shiki-token-comment)",
        fontStyle: "italic",
      },
    },
    {
      scope: [
        "entity.name.function",
        "entity.name.method",
        "support.function",
        "meta.function-call",
      ],
      settings: { foreground: "var(--shiki-token-function)" },
    },
    {
      scope: [
        "constant",
        "constant.numeric",
        "constant.language",
        "constant.character",
        "variable.other.constant",
      ],
      settings: { foreground: "var(--shiki-token-constant)" },
    },
    {
      scope: [
        "punctuation",
        "meta.brace",
        "punctuation.section",
        "punctuation.separator",
        "punctuation.terminator",
      ],
      settings: { foreground: "var(--shiki-token-punctuation)" },
    },
  ],
};
