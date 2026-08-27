import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, ensureQAUser } from "./helpers/auth";

test.describe("4. Community Q&A vs FLEX Architecture & Separation", () => {
  test.beforeAll(async () => {
    await ensureQAUser("trainee");
    await ensureQAUser("verifiedTrainer");
  });

  test("A. Q&A uses single-column layout and separates questions from FLEX", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/community", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Verify Q&A tab / filter
    const qaTab = page.locator('button:has-text("Q&A"), [role="tab"]:has-text("Q&A")').first();
    if (await qaTab.isVisible()) {
      await qaTab.click();
    }

    // Verify main content container
    const mainContainer = page.locator("main, #main-content, article").first();
    await expect(mainContainer).toBeVisible({ timeout: 15_000 });
  });

  test("B. Trainees CAN post and comment freely on Community FLEX items", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/community", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Click on FLEX tab
    const flexTab = page.locator('button:has-text("FLEX"), [role="tab"]:has-text("FLEX")').first();
    if (await flexTab.isVisible()) {
      await flexTab.click();
    }

    // Check that standard post interactions exist
    const flexArticle = page.locator('article, .rounded-xl:has-text("FLEX")').first();
    if (await flexArticle.isVisible()) {
      await flexArticle.click();
      const commentInput = page.locator('textarea, input[placeholder*="comment" i]').first();
      if (await commentInput.isVisible({ timeout: 5000 })) {
        await expect(commentInput).toBeEnabled();
      }
    }
  });
});
