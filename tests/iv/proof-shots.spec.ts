import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const OUT = path.resolve(process.cwd(), "docs/proof/ryanhenderson.dev-wwy");
fs.mkdirSync(OUT, { recursive: true });

const desktop = { width: 1280, height: 900 };

async function shot(page: any, name: string) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
}

test.describe.configure({ mode: "serial" });

test("proof: desktop captures (system-default theme, light, dark)", async ({ browser }) => {
  // Default theme follows prefers-color-scheme. Force LIGHT scheme first for
  // most shots so screenshots match the brutalist light aesthetic.
  const ctxLight = await browser.newContext({
    viewport: desktop,
    colorScheme: "light",
  });
  const page = await ctxLight.newPage();

  await page.goto("/", { waitUntil: "networkidle" });
  await shot(page, "01-home-light.png");

  // Blog hidden — /posts/, /posts/<slug>/ shots skipped (02, 03, 04).
  // Restore the four `await page.goto("/posts/...")` + `shot(...)` calls
  // when BLOG_VISIBLE flips back on.

  await page.goto("/about/", { waitUntil: "networkidle" });
  await shot(page, "05-about-light.png");

  await page.goto("/work/", { waitUntil: "networkidle" });
  await shot(page, "06-work-index-light.png");

  // Project detail pages were removed (titles link out to marketing
  // sites). Shots 07/08 (alpha detail, bravo "no repo" fixture) were
  // dropped along with the alpha/bravo fixtures themselves. Restore when
  // /work/<slug>/ pages return.

  // Tag archive — `software` is project-only and survives blog-hidden.
  // Restore `/tags/meta/` (post-shared) when BLOG_VISIBLE flips back on.
  await page.goto("/tags/software/", { waitUntil: "networkidle" });
  await shot(page, "09-tag-archive-software-light.png");

  // 404
  const r = await page.goto("/no-such-page/", { waitUntil: "domcontentloaded" });
  expect(r?.status()).toBe(404);
  await shot(page, "10-404-light.png");

  await ctxLight.close();
});

test("proof: dark mode + theme toggle persistence", async ({ browser }) => {
  // System dark — verifies prefers-color-scheme path
  const ctxDark = await browser.newContext({
    viewport: desktop,
    colorScheme: "dark",
  });
  const page = await ctxDark.newPage();

  await page.goto("/", { waitUntil: "networkidle" });
  await shot(page, "11-home-dark-system.png");

  // Blog hidden — `/posts/hello-world/` shot (12) skipped. Restore when
  // BLOG_VISIBLE flips back on.

  // Project detail pages removed — `/work/alpha/` shot (13) skipped.
  // The /work/ index already exercises the dark theme via project cards.

  await ctxDark.close();
});

test("proof: search interaction (Pagefind lazy-load)", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: desktop, colorScheme: "light" });
  const page = await ctx.newPage();

  await page.goto("/search/", { waitUntil: "networkidle" });
  await shot(page, "14-search-empty-light.png");

  // Click the lazy-load button if it exists, then type a query.
  const loadBtn = page.locator("button", { hasText: /load search/i }).first();
  if (await loadBtn.count()) {
    await loadBtn.click();
    await page.waitForTimeout(1500);
  }
  const input = page.locator(
    "input[type='search'], input[placeholder*='search' i]"
  ).first();
  if (await input.count()) {
    await input.fill("hello");
    await page.waitForTimeout(1500);
    await shot(page, "15-search-results-hello-light.png");
  } else {
    await shot(page, "15-search-no-input-found-light.png");
  }

  await ctx.close();
});

test("proof: mobile viewport (375x812)", async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: "light",
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  await page.goto("/", { waitUntil: "networkidle" });
  await shot(page, "16-mobile-home-light.png");

  // Blog hidden — `/posts/hello-blog/` mobile shot (17) skipped.
  // Restore when BLOG_VISIBLE flips back on.

  await page.goto("/work/", { waitUntil: "networkidle" });
  await shot(page, "18-mobile-work-light.png");

  await ctx.close();
});

test("proof: theme toggle persists across navigation", async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: desktop,
    colorScheme: "light",
  });
  const page = await ctx.newPage();

  await page.goto("/", { waitUntil: "networkidle" });
  // Click the toggle (header button labelled "light" when current theme is light)
  const toggle = page.locator("button[aria-label*='theme' i], button:has-text('light'), button:has-text('dark')").first();
  if (await toggle.count()) {
    await toggle.click();
    await page.waitForTimeout(300);
    await shot(page, "19-home-after-toggle.png");

    // Navigate to another page; theme must survive
    await page.goto("/work/", { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    await shot(page, "20-work-after-toggle-persists.png");
  } else {
    await shot(page, "19-toggle-not-found.png");
  }

  await ctx.close();
});

// Blog hidden — /feed.xml and /atom.xml are not built; only the sitemap
// shot survives. Restore the feed shots when BLOG_VISIBLE flips back on.
test("proof: sitemap (XML)", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: desktop, colorScheme: "light" });
  const page = await ctx.newPage();
  await page.goto("/sitemap-index.xml");
  await shot(page, "23-sitemap.png");
  await ctx.close();
});

test("proof: OG cards (rendered preview)", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: desktop, colorScheme: "light" });
  const page = await ctx.newPage();
  // Start from an HTML route, then replace content
  await page.goto("/about/", { waitUntil: "load" });
  // Blog hidden + project detail pages removed → no per-slug OG cards
  // are generated. Sample only the fallback. Restore per-slug samples
  // (post + project) when their respective routes return.
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><title>OG cards</title>
     <body style="margin:0;background:#0d0d0d;color:#fff;font-family:monospace">
       <div style="padding:16px">/og-default.png (fallback)</div>
       <img src="http://127.0.0.1:4321/og-default.png" style="width:100%;display:block">
     </body>`,
    { waitUntil: "load" }
  );
  await page.waitForTimeout(800);
  await shot(page, "24-og-cards-sample.png");
  await ctx.close();
});
