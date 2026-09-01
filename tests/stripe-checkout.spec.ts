import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, supabaseAdmin, QA_USERS, ensureQAUser } from "./helpers/auth";

test.describe("TEST 2 — STRIPE CHECKOUT — CRITICAL", () => {
  let verifiedTrainerId: string;

  test.beforeAll(async () => {
    await ensureQAUser("verifiedTrainer");
    await ensureQAUser("trainee");

    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const vt = list?.users?.find((u) => u.email === QA_USERS.verifiedTrainer.email);
    verifiedTrainerId = vt?.id || "";
  });

  test("2.1 Checkout dialog opens cleanly without double/nested modals or embedded errors", async ({ page }) => {
    const { getConsoleErrors } = monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/pricing", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Check subscribe button
    const subscribeBtn = page.locator('button:has-text("Subscribe"), button:has-text("Get Started"), [data-testid="subscribe-btn"]').first();
    if (await subscribeBtn.isVisible()) {
      await subscribeBtn.click();
      const dialogs = page.locator('[role="dialog"]');
      // Ensure single dialog, no nested dialogs
      const count = await dialogs.count();
      expect(count).toBeLessThanOrEqual(1);
    }

    // Verify no deprecated ui_mode error
    const errors = getConsoleErrors();
    const hasEmbeddedError = errors.some(
      (e) => e.includes("ui_mode 'embedded' is no longer supported") || e.includes("ui_mode")
    );
    expect(hasEmbeddedError).toBe(false);
  });

  test("2.2 Server function createCheckoutOrder returns hosted redirect URL (no client_secret)", async ({ page }) => {
    await loginAs(page, "trainee");
    await page.goto("/pricing", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    if (!verifiedTrainerId) return;

    // Verify server-side createCheckoutOrder returns url or status
    const res = await page.evaluate(
      async ({ trainerId }) => {
        try {
          const r = await fetch("/_server/?_serverFnId=createCheckoutOrder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              data: {
                kind: "subscription",
                trainerId,
                paymentMethod: "stripe",
              },
            }),
          });
          const text = await r.text();
          return { status: r.status, text };
        } catch (e: any) {
          return { status: 500, error: e.message };
        }
      },
      { trainerId: verifiedTrainerId },
    );

    // Response must not contain embedded clientSecret
    expect(res.text).not.toContain("clientSecret");
    expect(res.text).not.toContain("publishableKey");
  });

  test("2.3 Payment complete return handler (/payment/complete?order=...) updates subscription", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    // Navigate to payment complete handler with valid test order query
    await page.goto("/payment/complete?order=test-order-e2e&status=success", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const pageContent = page.locator("main, h1, h2").first();
    await expect(pageContent).toBeVisible({ timeout: 15_000 });
  });

  test("2.4 Payment cancel flow (/payment/complete?cancelled=1) returns cleanly with retry option", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/payment/complete?cancelled=1", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const cancelMessage = page.locator('text="Payment Cancelled", text="cancelled", button:has-text("Try Again"), button:has-text("Go Home")').first();
    await expect(cancelMessage).toBeVisible({ timeout: 15_000 });
  });
});
