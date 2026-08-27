import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, ensureQAUser } from "./helpers/auth";

test.describe("14. Mobile Viewport Responsiveness & Layout Integrity", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(async () => {
    await ensureQAUser("trainee");
  });

  test("A. Mobile Feed renders clean responsive layout without horizontal overflow", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    const header = page.locator("header, nav").first();
    await expect(header).toBeVisible({ timeout: 15_000 });
  });

  test("B. Mobile Trainer Profile & Discovery Grid render without horizontal overflow", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/explore", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    const grid = page.locator("main, .grid").first();
    await expect(grid).toBeVisible({ timeout: 15_000 });
  });
});
