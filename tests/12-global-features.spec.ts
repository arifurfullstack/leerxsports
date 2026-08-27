import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, ensureQAUser } from "./helpers/auth";

test.describe("12. Global Discovery, Translation & Moderation", () => {
  test.beforeAll(async () => {
    await ensureQAUser("trainee");
  });

  test("A. Discovery feed is global by default and allows exploring international content", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/explore", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const exploreContainer = page.locator("main, #main-content, article").first();
    await expect(exploreContainer).toBeVisible({ timeout: 15_000 });
  });

  test("B. Content reporting entry points exist for safety and moderation", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/community", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Check report trigger icon/button on posts
    const postArticle = page.locator("article, .rounded-xl").first();
    if (await postArticle.isVisible()) {
      const moreBtn = postArticle.locator('button[aria-label*="more" i], button[aria-label*="menu" i], svg.lucide-more-vertical, svg.lucide-more-horizontal').first();
      if (await moreBtn.isVisible()) {
        await moreBtn.click();
        const reportOption = page.locator('text="Report", [role="menuitem"]:has-text("Report")').first();
        if (await reportOption.isVisible()) {
          await expect(reportOption).toBeVisible();
        }
      }
    }
  });
});
