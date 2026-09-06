import { defineConfig } from "@playwright/test";

const database = new URL(process.env.DATABASE_URL || "");
if (database.pathname !== "/irenee_audit_security_test" || database.hostname !== "localhost") {
  throw new Error("The audit browser checks require the isolated audit database.");
}
export default defineConfig({
  testDir: "./e2e",
  testMatch: "september-audit.spec.ts",
  workers: 1,
  timeout: 45000,
  outputDir: "/var/cache/irenee-audit-playwright/results",
  reporter: "line",
  use: { baseURL: "http://127.0.0.1:3109", browserName: "chromium", locale: "fr-FR", screenshot: "only-on-failure" },
  webServer: {
    command: "/usr/local/bin/node26 node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3109",
    env: { ...process.env, AUTH_COOKIE_SECURE: "false" },
    url: "http://127.0.0.1:3109",
    reuseExistingServer: false
  }
});
