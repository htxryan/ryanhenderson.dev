import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import { cssVariablesTheme } from "./src/lib/shiki-theme.mjs";

export default defineConfig({
  site: "https://ryanhenderson.dev",
  integrations: [mdx()],
  trailingSlash: "always",
  build: {
    format: "directory",
  },
  // E4 — single Shiki invocation, theme bound to the E2 `--shiki-*` CSS
  // variable surface (advisory P2 #15). Light/dark switch by swapping the
  // underlying CSS variables under [data-theme="dark"], not by re-running
  // Shiki with a second theme.
  markdown: {
    shikiConfig: {
      theme: cssVariablesTheme,
    },
  },
});
