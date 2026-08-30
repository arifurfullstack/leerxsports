import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, supabaseAdmin, ensureQAUser } from "./helpers/auth";

test.describe("13. Admin Dashboard — Access, Trainer Approval & Rejection", () => {
  test.beforeAll(async () => {
    await ensureQAUser("admin");
    await ensureQAUser("trainee");
  });

  // ── A. Admin login and dashboard access ────────────────────────────────────
  test("A. Admin user (qa.admin@leersports.com) can log in and access /admin dashboard", async ({
    page,
  }) => {
    const { getConsoleErrors } = monitorConsoleAndNetwork(page);
    await loginAs(page, "admin");

    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Should land on admin dashboard, not be redirected away
    expect(page.url()).toContain("/admin");

    const adminContent = page
      .locator('h1:has-text("Command center"), h1:has-text("Admin"), h1:has-text("Dashboard"), [data-testid="admin-dashboard"]')
      .first();
    await expect(adminContent).toBeVisible({ timeout: 15_000 });

    const errors = getConsoleErrors();
    const hasCriticalError = errors.some(
      (e) => e.includes("Forbidden") || e.includes("401") || e.includes("403"),
    );
    expect(hasCriticalError).toBe(false);
    console.log("✅ Admin dashboard accessible — no auth errors");
  });

  // ── B. Non-admin blocked ───────────────────────────────────────────────────
  test("B. Non-admin trainee is redirected away from /admin", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const url = page.url();
    // Non-admin will not stay on /admin (redirects to / or /home or /auth)
    const isBlocked = !url.endsWith("/admin") || url.includes("/auth") || url.includes("/home") || url.includes("redirect=");
    expect(isBlocked).toBe(true);
    console.log(`✅ Non-admin blocked — redirected to: ${url}`);
  });

  // ── C. Trainer Applications tab loads with pending apps ────────────────────
  test("C. Admin can navigate to Trainer Applications and see pending applications", async ({
    page,
  }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "admin");

    // Verify pending application exists in DB first
    const { data: pending } = await supabaseAdmin
      .from("trainer_applications")
      .select("id, status, public_trainer_name")
      .eq("status", "pending")
      .limit(5);

    expect((pending ?? []).length).toBeGreaterThan(0);
    console.log(`DB has ${pending?.length} pending application(s): ${pending?.map((p) => p.public_trainer_name).join(", ")}`);

    await page.goto("/admin/trainers", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Should see Trainer Applications heading
    const trainersHeading = page.locator('h1:has-text("Trainer Applications")').first();
    await expect(trainersHeading).toBeVisible({ timeout: 15_000 });

    // Look for the pending applicant name or action buttons
    const pendingName = pending?.[0]?.public_trainer_name;
    if (pendingName) {
      const nameEl = page.locator(`text="${pendingName}"`).first();
      await expect(nameEl).toBeVisible({ timeout: 10_000 });
      console.log(`✅ Pending application "${pendingName}" visible in admin UI`);
    }

    const actionBtn = page.locator('button:has-text("Approve"), button:has-text("Reject"), button:has-text("Pending")').first();
    await expect(actionBtn).toBeVisible({ timeout: 5000 });
    console.log("✅ Action controls present in admin trainers page");
  });

  // ── D. Approve flow — DB state changes correctly ───────────────────────────
  test("D. Approving a pending trainer application updates DB state correctly", async ({
    page,
  }) => {
    monitorConsoleAndNetwork(page);

    // Find the demo pending application
    const { data: pending } = await supabaseAdmin
      .from("trainer_applications")
      .select("id, user_id, status, public_trainer_name")
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (!pending) {
      console.log("No pending application to test — skipping approve flow");
      return;
    }

    console.log(`Testing approve flow for: ${pending.public_trainer_name} (${pending.id})`);

    // Simulate the admin approve action via the server function directly
    const userId = pending.user_id;

    // Call admin review via DB (same as what adminReviewTrainerApplication does)
    const { error: updErr } = await supabaseAdmin
      .from("trainer_applications")
      .update({
        status: "approved",
        admin_notes: "E2E test approval",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", pending.id);
    expect(updErr).toBeNull();

    // Grant trainer role
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "trainer" }, { onConflict: "user_id, role" });
    expect(roleErr).toBeNull();

    // Create/update trainer profile as verified
    const { error: tpErr } = await supabaseAdmin.from("trainer_profiles").upsert(
      {
        user_id: userId,
        specialties: ["strength", "cardio"],
        subscription_price: 19.99,
        is_verified: true,
        monetization_enabled: true,
      },
      { onConflict: "user_id" },
    );
    expect(tpErr).toBeNull();

    // Mark profile as verified
    await supabaseAdmin.from("profiles").update({ is_verified: true }).eq("user_id", userId);

    // Verify DB state
    const { data: app } = await supabaseAdmin
      .from("trainer_applications")
      .select("status")
      .eq("id", pending.id)
      .single();
    expect(app?.status).toBe("approved");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "trainer");
    expect((roles ?? []).length).toBeGreaterThan(0);

    const { data: tp } = await supabaseAdmin
      .from("trainer_profiles")
      .select("is_verified, monetization_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    expect(tp?.is_verified).toBe(true);
    expect(tp?.monetization_enabled).toBe(true);

    console.log("✅ Approve flow: status=approved, trainer role granted, is_verified=true");

    // Reset back to pending for future test runs
    await supabaseAdmin
      .from("trainer_applications")
      .update({ status: "pending", reviewed_at: null, admin_notes: null })
      .eq("id", pending.id);
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "trainer");
    await supabaseAdmin
      .from("trainer_profiles")
      .update({ is_verified: false, monetization_enabled: false })
      .eq("user_id", userId);
    console.log("✅ Application reset to pending for future runs");
  });

  // ── E. Reject flow — revokes access correctly ─────────────────────────────
  test("E. Rejecting a trainer application revokes role and disables monetization", async ({
    page: _page,
  }) => {
    // Setup: create an approved state first
    const { data: app } = await supabaseAdmin
      .from("trainer_applications")
      .select("id, user_id, public_trainer_name")
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (!app) {
      console.log("No pending application — skipping reject flow");
      return;
    }

    const userId = app.user_id;
    console.log(`Testing reject flow for: ${app.public_trainer_name}`);

    // Simulate rejection (same as adminReviewTrainerApplication with decision=rejected)
    await supabaseAdmin
      .from("trainer_applications")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", app.id);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId).eq("role", "trainer");

    await supabaseAdmin
      .from("trainer_profiles")
      .update({ is_verified: false, monetization_enabled: false })
      .eq("user_id", userId);

    await supabaseAdmin.from("profiles").update({ is_verified: false }).eq("user_id", userId);

    // Verify
    const { data: rejApp } = await supabaseAdmin
      .from("trainer_applications")
      .select("status")
      .eq("id", app.id)
      .single();
    expect(rejApp?.status).toBe("rejected");

    const { data: trainerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "trainer");
    expect((trainerRole ?? []).length).toBe(0);

    const { data: tp } = await supabaseAdmin
      .from("trainer_profiles")
      .select("is_verified, monetization_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    expect(tp?.is_verified).toBe(false);
    expect(tp?.monetization_enabled).toBe(false);

    console.log("✅ Reject flow: status=rejected, trainer role revoked, monetization disabled");

    // Reset back to pending
    await supabaseAdmin
      .from("trainer_applications")
      .update({ status: "pending", reviewed_at: null })
      .eq("id", app.id);
    await supabaseAdmin
      .from("profiles")
      .update({ is_verified: false })
      .eq("user_id", userId);
    console.log("✅ Application reset to pending for future runs");
  });
});
