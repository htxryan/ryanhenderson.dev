import { describe, expect, test, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { JSDOM } from "jsdom";
import * as axeCore from "axe-core";
import type { AxeResults, Spec } from "axe-core";

/**
 * IV-3 — Accessibility smoke test on representative routes.
 *
 * Uses axe-core driven by jsdom. Cheaper than Playwright (no browser
 * launch); the trade-off is that jsdom does not compute layout, so axe
 * cannot evaluate rules that need real geometry (color-contrast). Those
 * are explicitly disabled here. The Playwright suite (IV-1) re-runs axe
 * in a real browser where contrast IS evaluated.
 *
 * Acceptance:
 *   - home, post, project, search produce zero serious/critical violations.
 */

const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist");

beforeAll(() => {
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error("Expected globalSetup to produce dist/index.html");
  }
});

interface Route {
  name: string;
  path: string;
}

// Blog hidden — `post (hello-world)` route omitted (no /posts/ pages
// built). Project detail pages removed — `project (alpha)` route swapped
// for the `/work/` index (only project-related route still built).
// Restore the post + project-detail routes when their respective pages
// return.
const routes: Route[] = [
  { name: "home", path: "index.html" },
  { name: "work index", path: "work/index.html" },
  { name: "search", path: "search/index.html" },
];

// Rules that need layout/geometry the jsdom DOM cannot provide. They are
// exercised in Playwright (IV-1).
const DISABLED_RULES = [
  "color-contrast",
  "color-contrast-enhanced",
  // axe occasionally needs scroll context to decide; skip for static smoke.
  "scrollable-region-focusable",
];

const AXE_SOURCE = readFileSync(
  resolve(ROOT, "node_modules/axe-core/axe.min.js"),
  "utf-8",
);

async function runAxe(html: string): Promise<AxeResults> {
  // Need runScripts: "dangerously" so a <script> tag injecting axe-core
  // executes in the jsdom realm. axe attaches itself to window.axe.
  const dom = new JSDOM(html, {
    url: "https://ryanhenderson.dev/",
    pretendToBeVisual: true,
    runScripts: "dangerously",
  });
  const { window } = dom;

  const script = window.document.createElement("script");
  script.textContent = AXE_SOURCE;
  window.document.head.appendChild(script);

  const w = window as unknown as {
    axe?: {
      run(ctx: Document, opts: object): Promise<AxeResults>;
      configure(s: Spec): void;
    };
  };
  if (!w.axe) {
    dom.window.close();
    throw new Error("axe failed to attach to jsdom window");
  }

  const result = await w.axe.run(window.document, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    },
    rules: Object.fromEntries(
      DISABLED_RULES.map((id) => [id, { enabled: false }]),
    ),
    resultTypes: ["violations"],
  });
  dom.window.close();
  return result;
}

describe("IV-3 — axe smoke on representative routes", () => {
  // axe-core is opaque about `import type` — silence unused warning.
  void axeCore;

  for (const r of routes) {
    test(`${r.name}: zero serious/critical a11y violations`, async () => {
      const html = readFileSync(join(DIST, r.path), "utf-8");
      const results = await runAxe(html);
      const blockers = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      if (blockers.length > 0) {
        const summary = blockers
          .map(
            (v) =>
              `  - [${v.impact}] ${v.id}: ${v.help}\n    nodes: ${v.nodes
                .map((n) => n.target.join(" "))
                .slice(0, 3)
                .join("; ")}`,
          )
          .join("\n");
        throw new Error(
          `axe found ${blockers.length} serious/critical violation(s) on ${r.name}:\n${summary}`,
        );
      }
      expect(blockers.length).toBe(0);
    }, 30_000);
  }
});
