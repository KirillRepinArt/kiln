// TRIAL (ROADMAP v0.7 step 1): Playwright running the ported tests in tools/tests/pw/ with the installed Edge.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tools/tests/pw",
  testMatch: "*.spec.mjs",
  outputDir: "tools/tests/out/pw",
  timeout: 120_000,
  reporter: [["list"], ["html", { outputFolder: "tools/tests/out/pw-report", open: "never" }]],
  use: {
    channel: "msedge",
    headless: true,
    viewport: { width: 1513, height: 900 },
    launchOptions: { args: ["--no-proxy-server"] },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
