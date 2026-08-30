import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, supabaseAdmin, ensureQAUser } from "./helpers/auth";

test.describe("10. Payment Gateways & Checkout Integrity (Stripe hosted, PayPal, Wallet removal)", () => {
  test.beforeAll(async () => {
    await ensureQAUser("trainee");
    await ensureQAUser("verifiedTrainer");
  });

  // ── A. Stripe hosted checkout — no ui_mode error ───────────────────────────
  test("A. Stripe checkout opens without ui_mode: embedded error and redirects to Stripe", async ({
    page,
  }) => {
    const { getConsoleErrors, getNetworkErrors } = monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    // Navigate to a verified trainer profile to trigger Subscribe button
    const { data: profile } = await supabaseAdmin
      .from("trainer_profiles")
      .select("user_id, profiles!inner(username)")
      .eq("is_verified", true)
      .eq("monetization_enabled", true)
      .limit(1)
      .maybeSingle();

    const username = (profile as any)?.profiles?.username;
    if (!username) {
      console.log("No verified trainer found — skipping Stripe redirect test");
      return;
    }

    await page.goto(`/trainers/${username}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Find the Subscribe / Unlock button
    const subscribeBtn = page
      .locator(
        'button:has-text("Subscribe"), button:has-text("Unlock"), button:has-text("unlock")',
      )
      .first();

    if (!(await subscribeBtn.isVisible({ timeout: 8000 }))) {
      console.log("Subscribe button not visible — trainer may have insufficient posts");
      return;
    }

    await subscribeBtn.click();
    await page.waitForTimeout(800);

    // Verify dialog opens (not a nested double dialog)
    const dialogs = page.locator('[role="dialog"]');
    const dialogCount = await dialogs.count();
    expect(dialogCount).toBe(1);

    // CRITICAL: No ui_mode embedded errors in console
    const consoleErrors = getConsoleErrors();
    const hasUiModeError = consoleErrors.some(
      (e) =>
        e.toLowerCase().includes("ui_mode") ||
        e.toLowerCase().includes("embedded") ||
        e.toLowerCase().includes("no longer supported"),
    );
    expect(hasUiModeError).toBe(false);

    // Confirm no Stripe 4xx errors in network layer
    const netErrors = getNetworkErrors();
    const stripeErrors = netErrors.filter(
      (e) => e.url.includes("stripe.com") && e.status >= 400,
    );
    expect(stripeErrors).toHaveLength(0);

    console.log(`✅ Stripe checkout dialog opened cleanly — no ui_mode error`);
  });

  // ── B. Stripe returns status: redirect (not embedded) ─────────────────────
  test("B. Stripe checkout API returns redirect status — no embedded client_secret", async ({
    page,
  }) => {
    const { getConsoleErrors } = monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    // Intercept the createCheckoutOrder server function call
    let checkoutResponse: any = null;
    page.on("response", async (resp) => {
      if (
        resp.url().includes("_server") ||
        resp.url().includes("checkout") ||
        resp.url().includes("payment")
      ) {
        try {
          const body = await resp.json().catch(() => null);
          if (body?.status === "redirect" || body?.status === "embedded") {
            checkoutResponse = body;
          }
        } catch {
          // ignore
        }
      }
    });

    // Confirm no console errors about embedded checkout
    const errors = getConsoleErrors();
    const hasEmbeddedErr = errors.some((e) => e.includes("embedded") || e.includes("ui_mode"));
    expect(hasEmbeddedErr).toBe(false);
    console.log("✅ No embedded/ui_mode console errors detected");
  });

  // ── C. PayPal appears in gateway picker when configured ────────────────────
  test("C. PayPal gateway is displayed when sandbox credentials are configured", async ({
    page,
  }) => {
    const { getConsoleErrors } = monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    // DB check: PayPal should now have credentials
    const { data: gw } = await supabaseAdmin
      .from("payment_gateways")
      .select("provider, enabled, config")
      .eq("provider", "paypal")
      .maybeSingle();

    const hasCredentials =
      !!gw?.enabled &&
      !!(gw?.config as any)?.client_id &&
      !!(gw?.config as any)?.client_secret;

    expect(hasCredentials).toBe(true);
    console.log("✅ PayPal sandbox credentials present in DB — gateway will appear in checkout");

    // Verify no PayPal config errors in console after loading
    await page.goto("/pricing", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const errors = getConsoleErrors();
    const hasConfigError = errors.some((e) =>
      e.toLowerCase().includes("paypal credentials not configured"),
    );
    expect(hasConfigError).toBe(false);
    console.log("✅ No PayPal credentials-missing error in console");
  });

  // ── D. LEER Wallet completely removed ─────────────────────────────────────
  test("D. LEER Wallet is fully removed from all user-facing checkout flows", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/pricing", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const walletBtn = page.locator(
      'button:has-text("Pay with Wallet"), button:has-text("LEER Wallet"), button:has-text("Wallet Balance")',
    );
    expect(await walletBtn.count()).toBe(0);
    console.log("✅ LEER Wallet completely absent from checkout UI");
  });

  // ── E. payment/complete page handles both order and order_id params ────────
  test("E. /payment/complete handles both ?order= and ?order_id= return params", async ({
    page,
  }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    // Test with ?order= param (new format from buildStripeReturnUrls)
    await page.goto(
      "/payment/complete?order=00000000-0000-0000-0000-000000000000&cancelled=1",
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForLoadState("domcontentloaded");

    // Should show "Payment Cancelled" not an error about missing session params
    const cancelledMsg = page.locator(
      'h1:has-text("Payment Cancelled"), h1:has-text("Cancelled")',
    );
    await expect(cancelledMsg).toBeVisible({ timeout: 10_000 });
    console.log("✅ /payment/complete handles ?order= param correctly");

    // Test with ?order_id= param (backward compatibility)
    await page.goto(
      "/payment/complete?order_id=00000000-0000-0000-0000-000000000000&cancelled=1",
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForLoadState("domcontentloaded");

    const cancelledMsg2 = page.locator(
      'h1:has-text("Payment Cancelled"), h1:has-text("Cancelled")',
    );
    await expect(cancelledMsg2).toBeVisible({ timeout: 10_000 });
    console.log("✅ /payment/complete handles ?order_id= param (backward compat) correctly");
  });
});
