import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env / .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const BASE_URL = process.env.BASE_URL || "http://localhost:3333";

export default defineConfig({
  webServer: {
    command: "npx vite dev --port 3333",
    port: 3333,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  testDir: "./tests",
  fullyParallel: false, // Run tests in predictable sequence
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single worker to avoid race conditions on test accounts
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
    ["json", { outputFile: "playwright-report/results.json" }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "mobile-chrome",
      testMatch: /.*mobile-ui\.spec\.ts/,
      use: {
        ...devices["Pixel 7"],
      },
    },
  ],
});
