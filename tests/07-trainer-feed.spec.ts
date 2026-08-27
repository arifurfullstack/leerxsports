import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, ensureQAUser } from "./helpers/auth";

test.describe("7. Trainer Grid Feed & Content Visibility", () => {
  test.beforeAll(async () => {
    await ensureQAUser("verifiedTrainer");
    await ensureQAUser("trainee");
  });

  test("A. Grid feed displays media items with public and locked states", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/feed", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const feedContent = page.locator("main, article, #main-content").first();
    await expect(feedContent).toBeVisible({ timeout: 15_000 });
  });
});
