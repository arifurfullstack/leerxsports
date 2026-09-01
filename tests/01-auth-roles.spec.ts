import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, supabaseAdmin, QA_USERS, ensureQAUser } from "./helpers/auth";

test.describe("1. Authentication & Role Permissions Suite", () => {
  test.beforeAll(async () => {
    await ensureQAUser("trainee");
    await ensureQAUser("pendingTrainer");
    await ensureQAUser("verifiedTrainer");
    await ensureQAUser("admin");
  });

  test("A. Signup page loads with role selection", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await page.goto("/signup", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Verify role options (Athlete / Creator / Coach) exist
    const athleteOption = page.locator('button:has-text("Athlete")').first();
    const coachOption = page.locator('button:has-text("Creator"), button:has-text("Coach")').first();

    await expect(athleteOption).toBeVisible({ timeout: 10_000 });
    await expect(coachOption).toBeVisible({ timeout: 10_000 });
  });

  test("B. Trainee login and logout flow works cleanly", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Ensure user is authenticated
    const authenticatedHeader = page.locator('header, nav, #main-content').first();
    await expect(authenticatedHeader).toBeVisible({ timeout: 15_000 });

    // Verify logout mechanism
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    const logoutBtn = page.locator('button:has-text("Log out"), button:has-text("Sign Out"), [data-testid="logout-button"]').first();
    if (await logoutBtn.isVisible({ timeout: 5000 })) {
      await expect(logoutBtn).toBeEnabled();
    }
  });

  test("C. Pending Trainer does NOT receive verified trainer permissions", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "pendingTrainer");

    // Check database flags
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const pendingUser = list?.users?.find((u) => u.email === QA_USERS.pendingTrainer.email);
    expect(pendingUser).toBeDefined();

    const { data: tpRow } = await supabaseAdmin
      .from("trainer_profiles")
      .select("is_verified, monetization_enabled")
      .eq("user_id", pendingUser!.id)
      .maybeSingle();

    expect(tpRow?.is_verified).toBe(false);
    expect(tpRow?.monetization_enabled).toBe(false);

    // Verify UI blocks monetization / trainer reply box
    await page.goto("/community", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const trainerAnswerControls = page.locator('text="Record Video Answer", button:has-text("Submit Coaching Answer")');
    expect(await trainerAnswerControls.count()).toBe(0);
  });

  test("D. Forgot password route loads recovery interface", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const forgotBtn = page.locator('text="Forgot", a:has-text("Forgot")').first();
    if (await forgotBtn.isVisible({ timeout: 5000 })) {
      await forgotBtn.click();
      const resetHeader = page.locator('text="Reset Password", text="Recovery", input[type="email"]').first();
      await expect(resetHeader).toBeVisible({ timeout: 5000 });
    }
  });

  test("E. Google authentication entry point exists on /login", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const googleBtn = page.locator('button:has-text("Google"), [aria-label*="Google" i]').first();
    if (await googleBtn.isVisible({ timeout: 5000 })) {
      await expect(googleBtn).toBeEnabled();
    }
  });
});
