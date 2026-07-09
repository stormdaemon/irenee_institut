import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT || 3101);
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01,
      scale: "css"
    }
  },
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  outputDir: ".playwright-artifacts/test-results",
  reporter: [
    ["line"],
    ["html", { open: "never", outputFolder: ".playwright-artifacts/report" }]
  ],
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    colorScheme: "light",
    contextOptions: { reducedMotion: "reduce" },
    locale: "fr-FR",
    serviceWorkers: "block",
    storageState: "e2e/.auth/director.json",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" }
    }
  ],
  webServer: {
    command: `bunx next start --hostname 127.0.0.1 --port ${port}`,
    env: {
      ...process.env,
      AUTH_COOKIE_SECURE: "false"
    },
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120_000,
    url: baseURL
  }
});
