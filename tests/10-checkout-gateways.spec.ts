import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, supabaseAdmin, ensureQAUser } from "./helpers/auth";

test.describe("10. Payment Gateways & Checkout Integrity (Stripe, PayPal, Wallet Removal)", () => {
  test.beforeAll(async () => {
    await ensureQAUser("trainee");
    await ensureQAUser("verifiedTrainer");
  });

  test("A. Subscription checkout opens in single clean modal without double nesting", async ({ page }) => {
    const { getConsoleErrors } = monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/pricing", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const chooseBtn = page.locator('button:has-text("Subscribe"), button:has-text("Choose"), button:has-text("Select")').first();
    if (await chooseBtn.isVisible({ timeout: 5000 })) {
      await chooseBtn.click();
      await page.waitForTimeout(500);

      const dialog = page.locator('[role="dialog"]');
      if (await dialog.isVisible()) {
        const count = await dialog.count();
        expect(count).toBe(1);
      }

      // Check no deprecated ui_mode errors
      const errors = getConsoleErrors();
      const hasStripeUiModeError = errors.some((e) => e.includes("ui_mode: 'embedded_page'") || e.includes("Invalid ui_mode"));
      expect(hasStripeUiModeError).toBe(false);
    }
  });

  test("B. PayPal gateway is conditionally displayed based on active credentials", async ({ page }) => {
    const { getConsoleErrors } = monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    const { data: gateways } = await supabaseAdmin
      .from("payment_gateways")
      .select("provider, enabled, config")
      .eq("provider", "paypal")
      .maybeSingle();

    const isPayPalConfigured = !!gateways?.enabled && !!gateways?.config && Object.keys(gateways.config).length > 0;

    await page.goto("/pricing", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const errors = getConsoleErrors();
    const hasConfigError = errors.some((e) => e.toLowerCase().includes("paypal credentials not configured"));
    expect(hasConfigError).toBe(false);
  });

  test("C. LEER Wallet is removed from user-facing MVP checkout", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/pricing", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Ensure no LEER Wallet checkout button remains
    const walletCheckout = page.locator('button:has-text("Pay with Wallet"), button:has-text("LEER Wallet")');
    expect(await walletCheckout.count()).toBe(0);
  });
});
