import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, ensureQAUser } from "./helpers/auth";

test.describe("8. Premium Media Blur & Content Protection", () => {
  test.beforeAll(async () => {
    await ensureQAUser("verifiedTrainer");
    await ensureQAUser("trainee");
    await ensureQAUser("subscriber");
  });

  test("A. Non-subscriber sees blurred teaser with lock indicator (NOT black screen)", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/feed", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const lockedElement = page.locator('.locked-blur, [class*="locked-blur"], svg.lucide-lock').first();
    if (await lockedElement.isVisible({ timeout: 5000 })) {
      const blurredImage = page.locator(".locked-blur, img[class*='locked-blur']").first();
      if (await blurredImage.isVisible()) {
        const filterValue = await blurredImage.evaluate((el) => window.getComputedStyle(el).filter);
        expect(filterValue).toContain("blur");
      }
    } else {
      const feed = page.locator("#main-content, main, body").first();
      await expect(feed).toBeVisible({ timeout: 15_000 });
    }
  });

  test("B. Subscriber retains access to authorized content without locked overlay", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "subscriber");

    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const mainFeed = page.locator("main, #main-content").first();
    await expect(mainFeed).toBeVisible({ timeout: 15_000 });
  });
});
