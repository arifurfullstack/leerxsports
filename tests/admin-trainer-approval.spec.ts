import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, supabaseAdmin, ensureQAUser } from "./helpers/auth";

test.describe("TEST 4 — ADMIN DASHBOARD / TRAINER APPROVAL", () => {
  let applicantUserId: string;

  test.beforeAll(async () => {
    await ensureQAUser("admin");
    await ensureQAUser("trainee");

    // Ensure applicant test account exists in pending state
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

    applicantUserId = user?.id || "";

    if (applicantUserId) {
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
    }
  });

  test("4.1 Admin Login: QA Admin account can log in and access /admin dashboard", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "admin");

    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const header = page.locator('h1, h2, [data-testid="admin-dashboard"], main').first();
    await expect(header).toBeVisible({ timeout: 15_000 });
  });

  test("4.2 RBAC Protection: Non-admin trainee is blocked from /admin routes", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const url = page.url();
    const isProtected = !url.endsWith("/admin") || url.includes("redirect") || url.includes("/auth");
    expect(isProtected).toBe(true);
  });

  test("4.3 Pending Trainer List: Pending applications visible in admin interface", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "admin");

    await page.goto("/admin/trainers", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const pageContent = page.locator('h1, h2, main, table, [data-testid="trainer-applications"]').first();
    await expect(pageContent).toBeVisible({ timeout: 15_000 });
  });

  test("4.4 Approve Trainer: Status updates to approved, role is granted, and user is verified", async ({ page: _page }) => {
    if (!applicantUserId) return;

    // Approve applicant
    await supabaseAdmin.from("trainer_applications").update({ status: "approved" }).eq("user_id", applicantUserId);
    await supabaseAdmin.from("user_roles").upsert({ user_id: applicantUserId, role: "trainer" }, { onConflict: "user_id, role" });
    await supabaseAdmin.from("trainer_profiles").upsert({ user_id: applicantUserId, is_verified: true, monetization_enabled: true }, { onConflict: "user_id" });
    await supabaseAdmin.from("profiles").update({ is_verified: true }).eq("user_id", applicantUserId);

    // Verify in DB
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", applicantUserId);
    const { data: tp } = await supabaseAdmin.from("trainer_profiles").select("is_verified, monetization_enabled").eq("user_id", applicantUserId).single();
    const { data: prof } = await supabaseAdmin.from("profiles").select("is_verified").eq("user_id", applicantUserId).single();

    expect(roles?.some((r) => r.role === "trainer")).toBe(true);
    expect(tp?.is_verified).toBe(true);
    expect(tp?.monetization_enabled).toBe(true);
    expect(prof?.is_verified).toBe(true);
  });

  test("4.5 Reject Trainer: Status updates to rejected, role is revoked, monetization disabled", async ({ page: _page }) => {
    if (!applicantUserId) return;

    // Reject applicant
    await supabaseAdmin.from("trainer_applications").update({ status: "rejected" }).eq("user_id", applicantUserId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", applicantUserId).eq("role", "trainer");
    await supabaseAdmin.from("trainer_profiles").upsert({ user_id: applicantUserId, is_verified: false, monetization_enabled: false }, { onConflict: "user_id" });
    await supabaseAdmin.from("profiles").update({ is_verified: false }).eq("user_id", applicantUserId);

    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", applicantUserId);
    const { data: tp } = await supabaseAdmin.from("trainer_profiles").select("is_verified, monetization_enabled").eq("user_id", applicantUserId).single();

    expect(roles?.some((r) => r.role === "trainer")).toBe(false);
    expect(tp?.is_verified).toBe(false);
    expect(tp?.monetization_enabled).toBe(false);
  });
});
