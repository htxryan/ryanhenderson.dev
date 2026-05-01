/**
 * E7 — Satori → Resvg pipeline.
 *
 * Encapsulates the rendering side so route endpoints stay terse: one call
 * to `renderCardPng()` and they get bytes back. Fonts are loaded lazily
 * and memoised across calls in the same Node process so a build with
 * dozens of cards reads the woff once.
 *
 * Caching is keyed on `hash(frontmatter-relevant-input + template-source +
 * tokens-source)` so a token change invalidates every card and an
 * unchanged build reuses the cached PNG. Cache lives in
 * `node_modules/.cache/og/` so it survives between builds without polluting
 * the repo and is wiped naturally with `rm -rf node_modules`.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { buildCardTree, type CardInput } from "./template.ts";

// `astro build` runs from the repo root, but Vite bundles this module into
// `dist/chunks/`, so `import.meta.url` no longer points at `scripts/og/`.
// Resolve every read off `process.cwd()` (= repo root) so the cache, font,
// and source-hash inputs are stable regardless of where the bundled code
// physically lives.
const repoRoot = process.cwd();

const FONT_REGULAR = resolve(repoRoot, "src/assets/fonts/JetBrainsMono-Regular.woff");
const FONT_BOLD = resolve(repoRoot, "src/assets/fonts/JetBrainsMono-Bold.woff");
const TEMPLATE_SRC = resolve(repoRoot, "scripts/og/template.ts");
const TOKENS_SRC = resolve(repoRoot, "src/styles/tokens.ts");
const CACHE_DIR = resolve(repoRoot, "node_modules/.cache/og");

let fontRegularCache: Buffer | null = null;
let fontBoldCache: Buffer | null = null;
let templateHashCache: string | null = null;
let tokensHashCache: string | null = null;

function fontRegular(): Buffer {
  if (!fontRegularCache) fontRegularCache = readFileSync(FONT_REGULAR);
  return fontRegularCache;
}

function fontBold(): Buffer {
  if (!fontBoldCache) fontBoldCache = readFileSync(FONT_BOLD);
  return fontBoldCache;
}

function templateHash(): string {
  if (!templateHashCache) {
    templateHashCache = createHash("sha256")
      .update(readFileSync(TEMPLATE_SRC))
      .digest("hex")
      .slice(0, 16);
  }
  return templateHashCache;
}

function tokensHash(): string {
  if (!tokensHashCache) {
    tokensHashCache = createHash("sha256")
      .update(readFileSync(TOKENS_SRC))
      .digest("hex")
      .slice(0, 16);
  }
  return tokensHashCache;
}

function cacheKey(input: CardInput): string {
  const h = createHash("sha256");
  h.update(JSON.stringify(input));
  h.update(templateHash());
  h.update(tokensHash());
  return h.digest("hex");
}

function cachePath(key: string): string {
  return resolve(CACHE_DIR, `${key}.png`);
}

/**
 * Render one OG card to PNG bytes. Uses the on-disk cache when available.
 * The hash key changes if any of: frontmatter input, template source, or
 * tokens source changes — so editing tokens.ts or the template invalidates
 * every card on the next build.
 */
export async function renderCardPng(input: CardInput): Promise<Buffer> {
  const key = cacheKey(input);
  const cached = cachePath(key);

  if (existsSync(cached)) {
    return readFileSync(cached);
  }

  const tree = buildCardTree(input);
  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: [
      {
        name: "JetBrainsMono",
        data: fontRegular(),
        weight: 400,
        style: "normal",
      },
      {
        name: "JetBrainsMono",
        data: fontBold(),
        weight: 700,
        style: "normal",
      },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
  });
  const png = resvg.render().asPng();
  const buf = Buffer.from(png);

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cached, buf);

  return buf;
}

/**
 * Static-fallback bytes. Generated identically to per-slug cards but with
 * a fixed neutral "ryanhenderson.dev" message — used by the
 * `/og-default.png` route and as the catch in route try/catch blocks if a
 * slug-specific render throws.
 */
export const FALLBACK_INPUT: CardInput = {
  kind: "site",
  title: "ryanhenderson.dev",
  kicker: "writing & work — Ryan Henderson",
  mode: "light",
};

let fallbackCache: Buffer | null = null;

export async function renderFallbackPng(): Promise<Buffer> {
  if (fallbackCache) return fallbackCache;
  fallbackCache = await renderCardPng(FALLBACK_INPUT);
  return fallbackCache;
}
