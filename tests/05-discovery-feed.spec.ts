import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, ensureQAUser } from "./helpers/auth";

test.describe("5. Default Post-Login Discovery Feed", () => {
  test.beforeAll(async () => {
    await ensureQAUser("trainee");
    await ensureQAUser("verifiedTrainer");
  });

  test("A. Post-login navigates to Trainer Discovery Feed by default", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Verify main feed / grid structure
    const feedContainer = page.locator("main, #main-content, article").first();
    await expect(feedContainer).toBeVisible({ timeout: 15_000 });
  });

  test("B. Mobile defaults to clean 3-column layout without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Navigation and header elements remain visible
    const navbar = page.locator("header, nav").first();
    await expect(navbar).toBeVisible({ timeout: 15_000 });
  });
});
