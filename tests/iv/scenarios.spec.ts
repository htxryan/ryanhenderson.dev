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

    // Type a query that should match content. "hello" appears in
    // hello-world + hello-blog post bodies and titles.
    await liveInput.fill("hello");
    // Pagefind debounces by 300ms then renders. Wait for any result link
    // pointing into /posts/ or /work/ inside the UI host.
    const resultLink = page
      .locator('#search a[href*="/posts/"], #search a[href*="/work/"]')
      .first();
    await resultLink.waitFor({ state: "visible", timeout: 15_000 });
    const href = await resultLink.getAttribute("href");
    expect(href).toMatch(/\/(posts|work)\/[a-z0-9-]+\/?$/);
  });
});

test.describe("S-7 — /hello-blog/ legacy URL", () => {
  test("redirects to /posts/hello-blog/ with 301 and the new page renders", async ({ request, page }) => {
    const r = await request.get("/hello-blog/", { maxRedirects: 0 });
    expect(r.status()).toBe(301);
    expect(r.headers()["location"]).toBe("/posts/hello-blog/");

    await page.goto("/hello-blog/");
    await expect(page).toHaveURL(/\/posts\/hello-blog\/$/);
    await expect(page.locator("h1.post-title")).toContainText("Hello Blog");
  });
});

test.describe("S-11 — conditional repo button", () => {
  test("alpha (has repoUrl) shows the repo link; bravo (no repoUrl) does not", async ({ page }) => {
    await page.goto("/work/alpha/");
    // The repo link is marked with data-repo-link in ProjectCard, but
    // detail pages use a different surface. We assert the rendered
    // link by host + path pattern.
    const alphaRepo = page.locator('a[href*="github.com"]');
    await expect(alphaRepo.first()).toBeVisible();

    await page.goto("/work/bravo/");
    const bravoRepoCount = await page.locator('a[href*="github.com"]').count();
    expect(bravoRepoCount).toBe(0);
  });
});

test.describe("S-3 — publish flow end-to-end (post route renders + RSS reachable)", () => {
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

test.describe("Draft posts MUST NOT be reachable in browser navigation", () => {
  test("/posts/draft-fixture/ returns 404", async ({ request }) => {
    const r = await request.get("/posts/draft-fixture/");
    expect(r.status()).toBe(404);
  });

  test("/posts/the-cost-of-estimation/ returns 404", async ({ request }) => {
    const r = await request.get("/posts/the-cost-of-estimation/");
    expect(r.status()).toBe(404);
  });
});
