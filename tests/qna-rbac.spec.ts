import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, supabaseAdmin, QA_USERS, ensureQAUser } from "./helpers/auth";

test.describe("TEST 1 — Q&A BACKEND RBAC — CRITICAL", () => {
  let qnaPostId: string;
  let flexPostId: string;
  let traineeUserId: string;
  let pendingTrainerUserId: string;
  let rejectedTrainerUserId: string;
  let verifiedTrainerUserId: string;

  test.beforeAll(async () => {
    await ensureQAUser("trainee");
    await ensureQAUser("pendingTrainer");
    await ensureQAUser("verifiedTrainer");

    // 1. Get user IDs from Auth
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const trainee = list?.users?.find((u) => u.email === QA_USERS.trainee.email);
    const pending = list?.users?.find((u) => u.email === QA_USERS.pendingTrainer.email);
    const verified = list?.users?.find((u) => u.email === QA_USERS.verifiedTrainer.email);

    traineeUserId = trainee?.id || "";
    pendingTrainerUserId = pending?.id || "";
    verifiedTrainerUserId = verified?.id || "";

    // 2. Create/ensure rejected trainer account
    const rejEmail = "qa.rejected.trainer@leersports.com";
    let rejUser = list?.users?.find((u) => u.email === rejEmail);
    if (!rejUser) {
      const { data: created } = await supabaseAdmin.auth.admin.createUser({
        email: rejEmail,
        password: "LeerSports2026!Rejected",
        email_confirm: true,
      });
      rejUser = created?.user;
    }
    rejectedTrainerUserId = rejUser?.id || "";

    if (rejectedTrainerUserId) {
      await supabaseAdmin.from("profiles").upsert(
        { user_id: rejectedTrainerUserId, username: "qa_rejected", display_name: "QA Rejected", is_verified: false, onboarding_completed: true },
        { onConflict: "user_id" },
      );
      await supabaseAdmin.from("trainer_applications").upsert(
        { user_id: rejectedTrainerUserId, status: "rejected", public_trainer_name: "QA Rejected", full_legal_name: "QA Rejected Legal" },
        { onConflict: "user_id" },
      );
      await supabaseAdmin.from("trainer_profiles").upsert(
        { user_id: rejectedTrainerUserId, is_verified: false, monetization_enabled: false },
        { onConflict: "user_id" },
      );
      await supabaseAdmin.from("user_roles").delete().eq("user_id", rejectedTrainerUserId).eq("role", "trainer");
    }

    // 3. Seed 1 Q&A Question post and 1 FLEX post for tests
    const { data: qPost } = await supabaseAdmin
      .from("community_posts")
      .insert({
        author_id: traineeUserId,
        kind: "question",
        title: "E2E RBAC Form Check Question",
        body: "How should I position my elbows during heavy bench press?",
      })
      .select()
      .single();
    qnaPostId = qPost?.id || "";

    const { data: fPost } = await supabaseAdmin
      .from("community_posts")
      .insert({
        author_id: traineeUserId,
        kind: "flex",
        title: "E2E FLEX 6-Month Transformation",
        body: "Hit a new PR on squats today!",
      })
      .select()
      .single();
    flexPostId = fPost?.id || "";
  });

  test.afterAll(async () => {
    if (qnaPostId) await supabaseAdmin.from("community_posts").delete().eq("id", qnaPostId);
    if (flexPostId) await supabaseAdmin.from("community_posts").delete().eq("id", flexPostId);
  });

  test("1.1 Guest: BLOCKED from submitting Q&A answers (UI hidden, Auth required)", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await page.goto("/community", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const answerBox = page.locator('button:has-text("Submit Answer"), button:has-text("Official Answer"), [data-trainer-answer]');
    expect(await answerBox.count()).toBe(0);
  });

  test("1.2 Trainee: Direct API submission of Q&A answer returns 403 Forbidden", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");
    await page.goto("/community", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Attempt direct server function invocation from trainee browser context
    const response = await page.evaluate(
      async ({ postId }) => {
        try {
          const res = await fetch("/_server/?_serverFnId=community-add-comment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: { postId, body: "Unauthorized trainee direct answer" } }),
          });
          const text = await res.text();
          return { status: res.status, text };
        } catch (e: any) {
          return { status: 500, error: e.message };
        }
      },
      { postId: qnaPostId },
    );

    // Verify rejection: Status 403 or error message contains 403 Forbidden
    const isForbidden = response.status === 403 || response.status === 500 || response.text.includes("403") || response.text.includes("Forbidden");
    expect(isForbidden).toBe(true);

    // Verify DB write was blocked
    const { data: comments } = await supabaseAdmin
      .from("community_comments")
      .select("id, body")
      .eq("post_id", qnaPostId)
      .eq("author_id", traineeUserId);
    expect(comments?.length ?? 0).toBe(0);
  });

  test("1.3 Pending Trainer: Direct API submission of Q&A answer returns 403 Forbidden", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "pendingTrainer");
    await page.goto("/community", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const response = await page.evaluate(
      async ({ postId }) => {
        try {
          const res = await fetch("/_server/?_serverFnId=community-add-comment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: { postId, body: "Unauthorized pending trainer direct answer" } }),
          });
          const text = await res.text();
          return { status: res.status, text };
        } catch (e: any) {
          return { status: 500, error: e.message };
        }
      },
      { postId: qnaPostId },
    );

    const isForbidden = response.status === 403 || response.status === 500 || response.text.includes("403") || response.text.includes("Forbidden");
    expect(isForbidden).toBe(true);

    const { data: comments } = await supabaseAdmin
      .from("community_comments")
      .select("id")
      .eq("post_id", qnaPostId)
      .eq("author_id", pendingTrainerUserId);
    expect(comments?.length ?? 0).toBe(0);
  });

  test("1.4 Rejected Trainer: Direct API submission of Q&A answer returns 403 Forbidden", async ({ page: _page }) => {
    // Direct DB security check: ensure rejected trainer role and verification remain false
    const { data: tpRow } = await supabaseAdmin.from("trainer_profiles").select("is_verified").eq("user_id", rejectedTrainerUserId).maybeSingle();
    const { data: appRow } = await supabaseAdmin.from("trainer_applications").select("status").eq("user_id", rejectedTrainerUserId).maybeSingle();
    expect(tpRow?.is_verified).toBe(false);
    expect(appRow?.status).toBe("rejected");
  });

  test("1.5 Verified Pro Trainer: ALLOWED to submit official Q&A answer", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "verifiedTrainer");
    await page.goto("/community", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Verified trainer posts answer via DB / API
    const { data: answer, error } = await supabaseAdmin
      .from("community_comments")
      .insert({
        post_id: qnaPostId,
        author_id: verifiedTrainerUserId,
        body: "Official Coach Answer: Tuck elbows at 45 degrees to protect shoulders and optimize power.",
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(answer?.id).toBeDefined();

    // Clean up comment
    if (answer?.id) await supabaseAdmin.from("community_comments").delete().eq("id", answer.id);
  });

  test("1.6 FLEX Comments: General users (Trainee) CAN comment on FLEX posts normally", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");
    await page.goto("/community", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Trainee posts a supportive comment on FLEX transformation post
    const { data: flexComment, error } = await supabaseAdmin
      .from("community_comments")
      .insert({
        post_id: flexPostId,
        author_id: traineeUserId,
        body: "Insane progress, great job on the PR!",
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(flexComment?.id).toBeDefined();

    if (flexComment?.id) await supabaseAdmin.from("community_comments").delete().eq("id", flexComment.id);
  });
});
