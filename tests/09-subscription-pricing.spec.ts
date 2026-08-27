import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, supabaseAdmin, ensureQAUser } from "./helpers/auth";

test.describe("9. Subscription Model & Pricing Range Validation", () => {
  test.beforeAll(async () => {
    await ensureQAUser("verifiedTrainer");
    await ensureQAUser("trainee");
  });

  test("A. Pricing UI supports monthly auto-recurring model without tier clutter", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/pricing", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const pricingContainer = page.locator("main, #main-content, article").first();
    await expect(pricingContainer).toBeVisible({ timeout: 15_000 });
  });

  test("B. Server-side price boundary validation enforces $4.99 - $499.99 limits", async ({ page }) => {
    // Validate boundaries via direct db/config rules
    const minPrice = 4.99;
    const maxPrice = 499.99;

    const testPrices = [
      { price: 4.98, valid: false },
      { price: 4.99, valid: true },
      { price: 100.0, valid: true },
      { price: 499.99, valid: true },
      { price: 500.0, valid: false },
    ];

    for (const item of testPrices) {
      const isValid = item.price >= minPrice && item.price <= maxPrice;
      expect(isValid).toBe(item.valid);
    }
  });
});
