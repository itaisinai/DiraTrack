import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env" });

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL must be set in .env file");
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "api",
      testMatch: "e2e/api.spec.ts",
      grepInvert: /@live/,
      use: {},
    },
    {
      name: "chromium",
      testMatch: "e2e/user-flows.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
      grepInvert: /@mobile|@live/,
    },
    {
      name: "mobile",
      testMatch: "e2e/user-flows.spec.ts",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 },
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
      },
      grep: /@mobile/,
      grepInvert: /@live/,
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: false, // CRITICAL: Never reuse dev server - always use TEST_DATABASE_URL
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL, // Pass to worker as well
    },
  },
});
