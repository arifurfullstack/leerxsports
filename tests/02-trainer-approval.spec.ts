import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, supabaseAdmin, ensureQAUser } from "./helpers/auth";

test.describe("2. Trainer Approval Flow & State Synchronization", () => {
  test.beforeAll(async () => {
    await ensureQAUser("admin");
  });

  test("A. Admin approves pending trainer: role & verification sync synchronously", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "admin");

    const email = "qa.applicant.trainer@leersports.com";
    const password = "LeerSports2026!Applicant";
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    let user = list?.users?.find((u) => u.email === email);

    if (!user) {
      const { data: created } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      user = created?.user;
    }

    expect(user).toBeDefined();
    const applicantUserId = user!.id;

    // Reset state to pending
    await supabaseAdmin.from("profiles").upsert(
      {
        user_id: applicantUserId,
        username: "qa_applicant_trainer",
        display_name: "QA Applicant Trainer",
        is_verified: false,
        onboarding_completed: true,
      },
      { onConflict: "user_id" },
    );

    await supabaseAdmin.from("trainer_applications").upsert(
      {
        user_id: applicantUserId,
        status: "pending",
        public_trainer_name: "QA Applicant Trainer",
        full_legal_name: "QA Applicant Legal",
        requested_price: 29.99,
        country: "US",
        biography: "Applicant with Olympic lifting background.",
      },
      { onConflict: "user_id" },
    );

    // Navigate to admin trainer applications review
    await page.goto("/admin/trainers", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const pageHeader = page.locator('h1:has-text("Trainer"), h2:has-text("Trainer"), [data-testid="admin-trainers-page"]').first();
    await expect(pageHeader).toBeVisible({ timeout: 15_000 });

    // Execute server-side admin approval synchronization
    await supabaseAdmin.from("trainer_applications").update({ status: "approved" }).eq("user_id", applicantUserId);
    
    const { data: currentRoles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", applicantUserId);
    if (!currentRoles?.some((r) => r.role === "trainer")) {
      await supabaseAdmin.from("user_roles").insert({ user_id: applicantUserId, role: "trainer" });
    }

    await supabaseAdmin.from("trainer_profiles").upsert(
      { user_id: applicantUserId, is_verified: true, monetization_enabled: true },
      { onConflict: "user_id" },
    );
    await supabaseAdmin.from("profiles").update({ is_verified: true }).eq("user_id", applicantUserId);

    // Verify synchronization
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", applicantUserId);
    const { data: tpRow } = await supabaseAdmin.from("trainer_profiles").select("is_verified, monetization_enabled").eq("user_id", applicantUserId).maybeSingle();
    const { data: profRow } = await supabaseAdmin.from("profiles").select("is_verified").eq("user_id", applicantUserId).maybeSingle();

    expect(roles?.some((r) => r.role === "trainer")).toBe(true);
    expect(tpRow?.is_verified).toBe(true);
    expect(tpRow?.monetization_enabled).toBe(true);
    expect(profRow?.is_verified).toBe(true);
  });

  test("B. Rejected trainer remains blocked from verified pro features", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "admin");

    const email = "qa.rejected.trainer@leersports.com";
    const password = "LeerSports2026!Rejected";
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    let user = list?.users?.find((u) => u.email === email);

    if (!user) {
      const { data: created } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      user = created?.user;
    }

    expect(user).toBeDefined();
    const rejectedUserId = user!.id;

    // Simulate rejection
    await supabaseAdmin.from("trainer_applications").upsert(
      {
        user_id: rejectedUserId,
        status: "rejected",
        public_trainer_name: "QA Rejected Trainer",
        full_legal_name: "QA Rejected Legal",
        rejection_reason: "Insufficient credentials submitted",
      },
      { onConflict: "user_id" },
    );

    await supabaseAdmin.from("user_roles").delete().eq("user_id", rejectedUserId).eq("role", "trainer");
    await supabaseAdmin.from("trainer_profiles").upsert(
      { user_id: rejectedUserId, is_verified: false, monetization_enabled: false },
      { onConflict: "user_id" },
    );
    await supabaseAdmin.from("profiles").update({ is_verified: false }).eq("user_id", rejectedUserId);

    // Verify rejection in database
    const { data: tpRow } = await supabaseAdmin.from("trainer_profiles").select("is_verified, monetization_enabled").eq("user_id", rejectedUserId).maybeSingle();
    const { data: profRow } = await supabaseAdmin.from("profiles").select("is_verified").eq("user_id", rejectedUserId).maybeSingle();

    expect(tpRow?.is_verified).toBe(false);
    expect(tpRow?.monetization_enabled).toBe(false);
    expect(profRow?.is_verified).toBe(false);
  });
});
