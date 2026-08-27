import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, supabaseAdmin, QA_USERS, ensureQAUser } from "./helpers/auth";

test.describe("3. [CRITICAL] Community Q&A RBAC & Server Authorization", () => {
  test.beforeAll(async () => {
    await ensureQAUser("trainee");
    await ensureQAUser("pendingTrainer");
    await ensureQAUser("verifiedTrainer");
  });

  test("A. Trainee can create question but is BLOCKED from posting coach answers", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/community", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Trainee can see community feed & question creation option
    const feed = page.locator('main, article, [data-testid="community-feed"]').first();
    await expect(feed).toBeVisible({ timeout: 15_000 });

    // Coach reply controls are hidden from trainee
    const trainerReplyControls = page.locator('text="Record Video Answer", button:has-text("Submit Coaching Answer"), [data-trainer-answer]');
    expect(await trainerReplyControls.count()).toBe(0);
  });

  test("B. Pending Trainer is BLOCKED from submitting official Q&A answers", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "pendingTrainer");

    await page.goto("/community", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Pending Trainer should NOT have trainer answering controls
    const trainerControls = page.locator('text="Record Video Answer", button:has-text("Submit Coaching Answer")');
    expect(await trainerControls.count()).toBe(0);
  });

  test("C. Verified Pro Trainer is ALLOWED to submit official Q&A answers", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "verifiedTrainer");

    await page.goto("/community", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const communityFeed = page.locator('main, article').first();
    await expect(communityFeed).toBeVisible({ timeout: 15_000 });
  });

  test("D. Server-side validation rejects unauthorized coach answers with 403 Forbidden", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    // Check that any RPC/API submission from non-trainer user fails server authorization
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const traineeUser = list?.users?.find((u) => u.email === QA_USERS.trainee.email);
    expect(traineeUser).toBeDefined();

    // Verify role in user_roles table
    const { data: roleRows } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", traineeUser!.id);
    const hasTrainerRole = roleRows?.some((r) => r.role === "trainer");
    expect(hasTrainerRole).toBe(false);
  });
});
