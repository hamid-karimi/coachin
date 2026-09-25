import { defineConfig, devices } from "@playwright/test";

/**
 * QA journeys against the running compose stack (compose.yaml + compose.e2e.yaml,
 * then `make seed`). One worker: the journeys share the demo accounts' data.
 * PW_CHROMIUM_PATH points at a preinstalled Chromium (sandboxes); CI installs its own.
 */
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  workers: 1,
  timeout: 60_000,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Pixel 7"],
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    trace: "retain-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
});
