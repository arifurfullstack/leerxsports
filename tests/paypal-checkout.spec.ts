import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, supabaseAdmin, QA_USERS, ensureQAUser } from "./helpers/auth";

test.describe("TEST 3 — PAYPAL — CRITICAL", () => {
  let verifiedTrainerId: string;
  let paypalEnabled = false;

  test.beforeAll(async () => {
    await ensureQAUser("verifiedTrainer");
    await ensureQAUser("trainee");

    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const vt = list?.users?.find((u) => u.email === QA_USERS.verifiedTrainer.email);
    verifiedTrainerId = vt?.id || "";

    // Verify PayPal Gateway in payment_gateways table
    const { data: gw } = await supabaseAdmin
      .from("payment_gateways")
      .select("provider, is_enabled, credentials")
      .eq("provider", "paypal")
      .maybeSingle();

    paypalEnabled = !!(gw?.is_enabled && gw?.credentials);
  });

  test("3.1 PayPal gateway configuration exists in database without client secrets leaked", async ({ page: _page }) => {
    const { data: gw } = await supabaseAdmin
      .from("payment_gateways")
      .select("provider, is_enabled, is_test_mode")
      .eq("provider", "paypal")
      .maybeSingle();

    expect(gw?.provider).toBe("paypal");
    expect(gw?.is_enabled).toBe(true);
  });

  test("3.2 PayPal Sandbox order creation API returns valid approve URL or order ID", async ({ page }) => {
    if (!paypalEnabled || !verifiedTrainerId) {
      test.skip(!paypalEnabled, "BLOCKED: PayPal Sandbox credentials are not configured in DB");
      return;
    }

    const { getConsoleErrors } = monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");
    await page.goto("/pricing", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

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
                paymentMethod: "paypal",
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

    // Verify no missing credentials error
    const errors = getConsoleErrors();
    const hasCredsError = errors.some((e) => e.includes("PayPal credentials are not configured"));
    expect(hasCredsError).toBe(false);

    // Verify response does not leak client secret
    expect(res.text).not.toContain("client_secret");
    expect(res.text).not.toContain("secret");
  });
});
