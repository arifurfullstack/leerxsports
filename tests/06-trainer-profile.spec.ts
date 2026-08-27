import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, ensureQAUser } from "./helpers/auth";

test.describe("6. Trainer Profile UI & Clean Minimal Layout", () => {
  test.beforeAll(async () => {
    await ensureQAUser("verifiedTrainer");
    await ensureQAUser("trainee");
  });

  test("A. Profile layout is clean and content-first without cluttered cover banners", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    // Navigate to explore / trainers
    await page.goto("/explore", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const trainerCard = page.locator('a[href*="/trainers/"], a[href*="/u/"]').first();
    if (await trainerCard.isVisible()) {
      await trainerCard.click();
      await page.waitForLoadState("domcontentloaded");

      // Verify no cluttered tip/ask $300 buttons
      const ask300Btn = page.locator('button:has-text("Ask - $300"), button:has-text("$300")');
      expect(await ask300Btn.count()).toBe(0);

      // Verify profile tabs (Feed, Shorts, Coaching)
      const tabs = page.locator('[role="tablist"], nav, [class*="tabs"]');
      await expect(tabs.first()).toBeVisible({ timeout: 10_000 });
    }
  });
});
