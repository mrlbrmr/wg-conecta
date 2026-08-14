import { defineConfig, devices } from "@playwright/test";

/**
 * Configuração dos testes visuais de layout.
 * Roda contra o dev server local (http://localhost:8080).
 */
export default defineConfig({
  testDir: "./tests/visual",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }], ["github"]]
    : [["list"]],
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["iPhone 12"], viewport: { width: 375, height: 812 } },
    },
    {
      name: "desktop",
      use: { viewport: { width: 1280, height: 900 } },
    },
    {
      name: "desktop-wide",
      use: { viewport: { width: 1440, height: 900 } },
    },
  ],
});
