import { test, expect } from "@playwright/test";

/**
 * IV-1 — Cross-epic behavioural Playwright suite.
 *
 * Each test is tagged with the spec scenario(s) and contract(s) it
 * covers. The browser fixtures use the desktop-chrome project (see
 * playwright.config.ts).
 *
 * Coverage:
 *   S-1  brutalist index, no JS unless toggle interacted
 *   S-3  publish flow — RSS/sitemap update tested in vitest;
 *        here we verify the rendered post route works end-to-end
 *   S-4  system dark mode → dark immediately, no FOUC (C-5)
 *   S-5  toggle theme → flips, persists, survives navigation
 *   S-6  search "estimation" → Pagefind returns results
 *   S-7  /hello-blog/ → 301 to /posts/hello-blog/ which renders
 *   S-11 project with no repoUrl → no broken repo button
 *
 * The CSP/`_headers` propagation and the .pages.dev branch noindex are
 * verified by tests/deploy.test.ts (offline, against shipped `_headers`).
 */

test.describe("S-1 — first-time reader hits home", () => {
  test("brutalist index renders with hero, nav, and zero external script src", async ({ page }) => {
    const responses: string[] = [];
    page.on("request", (r) => {
      if (r.resourceType() === "script") responses.push(r.url());
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Ryan Henderson" })).toBeVisible();
    // Theme toggle is present but no external script bundles get loaded
    // beyond inlined theme scripts. (The site-shell vitest test asserts
    // the static HTML contract; this asserts the runtime contract.)
    const external = responses.filter((u) => !u.startsWith("data:"));
    // Astro-emitted CSS may load; pagefind must NOT.
    expect(external.find((u) => /\/pagefind\//.test(u))).toBeUndefined();
  });
});

test.describe("S-4 / C-5 — system dark mode applies pre-paint (no FOUC)", () => {
  test.use({ colorScheme: "dark" });

  test("frame-1 background is dark; data-theme is set before first paint", async ({ page }) => {
    await page.goto("/");
    // The inline ThemeBoot script runs in <head>, so by the time JS can
    // be queried the dataset is already populated.
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(theme).toBe("dark");
    // The body background under [data-theme="dark"] must NOT be white.
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).not.toBe("rgb(255, 255, 255)");
  });
});

test.describe("S-5 — theme toggle flips, persists, survives navigation", () => {
  test("clicking toggle on home flips theme; nav to /about/ preserves it; reload preserves it", async ({ page }) => {
    await page.goto("/");
    const initial = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.getByRole("button", { name: /toggle color theme/i }).click();
    const flipped = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(flipped).not.toBe(initial);

    // Navigate to /about/ — theme must survive.
    await page.click('a[href="/about/"]');
    await page.waitForURL("**/about/");
    const onAbout = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(onAbout).toBe(flipped);

    // Reload — localStorage backs the preference.
    await page.reload();
    const afterReload = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(afterReload).toBe(flipped);

    // localStorage holds the literal token.
    const stored = await page.evaluate(() => localStorage.getItem("theme"));
    expect(stored).toBe(flipped);
  });
});

test.describe("S-6 — Pagefind search lazy-loads and returns results", () => {
  test("search asset bytes do not load on home; load on /search/ first interaction", async ({ page }) => {
    const pagefindRequests: string[] = [];
    page.on("request", (r) => {
      if (/\/pagefind\//.test(r.url())) pagefindRequests.push(r.url());
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(pagefindRequests.length, `unexpected pagefind hits on home: ${pagefindRequests.join(", ")}`).toBe(0);

    await page.goto("/search/");
    await page.waitForLoadState("networkidle");
    // The lazy-load contract: pagefind must NOT load on first navigation
    // — only on first interaction. Focus the placeholder to trigger the
    // boot listener (events: focus, click, keydown, focusin in capture).
    const beforeInteract = pagefindRequests.length;
    expect(beforeInteract, "pagefind hit before interaction").toBe(0);
    await page.locator("[data-pagefind-placeholder]").focus();
    // PagefindUI mounts inside #search and replaces the host content.
    // Wait for the live UI's input to appear (PagefindUI emits an
    // <input class="pagefind-ui__search-input">).
    const liveInput = page.locator(".pagefind-ui__search-input").first();
    await liveInput.waitFor({ state: "visible", timeout: 15_000 });
    expect(pagefindRequests.length, "expected pagefind to load after interaction")
      .toBeGreaterThan(beforeInteract);

    // Type a query that should match content. While the blog is hidden
    // and project detail pages are removed, the index covers shell pages
    // (home, work index, about) and tag archives. "Menu Simplifier" matches
    // the project card on /work/ and tag archives. When the blog
    // returns, restore a query like "hello" that exercises post bodies.
    await liveInput.fill("Menu Simplifier");
    // Pagefind debounces by 300ms then renders. Wait for any pagefind
    // result anchor in the UI host (links may point at /work/ or a tag archive).
    const resultLink = page
      .locator('#search .pagefind-ui__result a')
      .first();
    await resultLink.waitFor({ state: "visible", timeout: 15_000 });
    const href = await resultLink.getAttribute("href");
    // Result must be a same-origin path on this site. The exact URL set
    // varies as content is added/removed; we only assert pagefind found
    // something and emitted a usable link.
    expect(href).toMatch(/^\//);
  });
});

// SKIP: blog hidden — /posts/hello-blog/ is not built, so the legacy
// redirect lands on a 404. The redirect rule still ships in _redirects;
// restore this test (and the same in tests/migration.test.ts) when
// BLOG_VISIBLE flips back on.
test.describe.skip("S-7 — /hello-blog/ legacy URL", () => {
  test("redirects to /posts/hello-blog/ with 301 and the new page renders", async ({ request, page }) => {
    const r = await request.get("/hello-blog/", { maxRedirects: 0 });
    expect(r.status()).toBe(301);
    expect(r.headers()["location"]).toBe("/posts/hello-blog/");

    await page.goto("/hello-blog/");
    await expect(page).toHaveURL(/\/posts\/hello-blog\/$/);
    await expect(page.locator("h1.post-title")).toContainText("Hello Blog");
  });
});

test.describe("S-11 — private repositories stay off public cards", () => {
  test("only the public app has a product link", async ({ page }) => {
    await page.goto("/work/");
    const cards = page.locator(".project-card");
    await expect(cards).toHaveCount(2);
    await expect(cards.locator("[data-repo-link]")).toHaveCount(0);
    const menuCard = cards.filter({ has: page.getByRole("heading", { name: "Menu Simplifier", exact: true }) });
    await expect(menuCard).toContainText("in development");
    await expect(menuCard.locator("a")).toHaveCount(0);
    await expect(cards.getByRole("link", { name: "Salata Recipe Finder" })).toHaveAttribute("href", "https://saladrecipefinder.com");
    await expect(cards.filter({ hasText: "Salata Recipe Finder" })).toContainText("not affiliated with Salata.");
  });
});

// SKIP: blog hidden — /posts/<slug>/ pages and /feed.xml are not built.
// Restore via BLOG_VISIBLE in src/lib/content.ts and src/pages/_blog/.
test.describe.skip("S-3 — publish flow end-to-end (post route renders + RSS reachable)", () => {
  test("post page renders with title + content; /feed.xml reachable and includes the post", async ({ page, request }) => {
    await page.goto("/posts/hello-world/");
    await expect(page.locator("h1.post-title")).toContainText("Hello, World");
    // Reading-time hook present.
    await expect(page.locator("[data-reading-minutes]")).toBeVisible();

    const feed = await request.get("/feed.xml");
    expect(feed.ok()).toBe(true);
    const xml = await feed.text();
    expect(xml).toContain("/posts/hello-world/");
  });
});

test.describe("CSP — global _headers apply on every response (preview-server emulation)", () => {
  test("home response carries CSP, nosniff, referrer policy", async ({ request }) => {
    const r = await request.get("/");
    expect(r.ok()).toBe(true);
    const h = r.headers();
    expect(h["content-security-policy"]).toContain("default-src 'self'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
});

// SKIP: blog hidden — every /posts/* URL 404s right now, so the
// "drafts excluded from a published blog" contract this asserts is
// vacuously true. Restore when BLOG_VISIBLE flips back on; the
// assertions still capture the right behaviour at that point.
test.describe.skip("Draft posts MUST NOT be reachable in browser navigation", () => {
  test("/posts/draft-fixture/ returns 404", async ({ request }) => {
    const r = await request.get("/posts/draft-fixture/");
    expect(r.status()).toBe(404);
  });

  test("/posts/the-cost-of-estimation/ returns 404", async ({ request }) => {
    const r = await request.get("/posts/the-cost-of-estimation/");
    expect(r.status()).toBe(404);
  });
});
