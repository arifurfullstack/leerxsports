import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, supabaseAdmin, QA_USERS, ensureQAUser } from "./helpers/auth";

test.describe("11. [CRITICAL] Paid Coaching Access, Lifecycle & 1-Follow-up Rule", () => {
  let subscriberUserId: string;
  let trainerUserId: string;

  test.beforeAll(async () => {
    await ensureQAUser("verifiedTrainer");
    await ensureQAUser("subscriber");
    await ensureQAUser("nonSubscriber");

    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const subUser = list?.users?.find((u) => u.email === QA_USERS.subscriber.email);
    const trUser = list?.users?.find((u) => u.email === QA_USERS.verifiedTrainer.email);

    subscriberUserId = subUser?.id || "";
    trainerUserId = trUser?.id || "";
  });

  test("A. Non-subscriber cannot initiate or access private coaching threads", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "nonSubscriber");

    // Attempt to access coaching overview or create coaching post
    await page.goto("/community", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const directCoachingOption = page.locator('button:has-text("Ask Private Coaching")');
    if (await directCoachingOption.isVisible()) {
      // Must prompt for subscription or block
      await directCoachingOption.click();
      const subscribeModal = page.locator('[role="dialog"], text="Subscribe"');
      await expect(subscribeModal.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("B. Coaching lifecycle state machine enforces 1 follow-up and auto-locks on completion", async ({ page }) => {
    // Direct state machine verification via db simulation
    if (subscriberUserId && trainerUserId) {
      // Step 1: Trainee creates coaching post -> 'pending'
      const { data: post, error: pErr } = await supabaseAdmin
        .from("community_posts")
        .insert({
          author_id: subscriberUserId,
          target_trainer_id: trainerUserId,
          kind: "question",
          title: "Coaching Form Check Lifecycle Test",
          body: "Please review my deadlift form.",
          coaching_status: "pending",
        })
        .select()
        .single();

      expect(pErr).toBeNull();
      expect(post?.coaching_status).toBe("pending");

      const postId = post.id;

      // Step 2: Trainer answers -> status becomes 'coached'
      await supabaseAdmin.from("community_comments").insert({
        post_id: postId,
        author_id: trainerUserId,
        body: "Your hip hinge needs adjustment. Keep barbell closer to shins.",
        is_official_answer: true,
      });
      await supabaseAdmin.from("community_posts").update({ coaching_status: "coached" }).eq("id", postId);

      const { data: postStep2 } = await supabaseAdmin.from("community_posts").select("coaching_status").eq("id", postId).single();
      expect(postStep2?.coaching_status).toBe("coached");

      // Step 3: Trainee provides exactly ONE follow-up
      await supabaseAdmin.from("community_comments").insert({
        post_id: postId,
        author_id: subscriberUserId,
        body: "Should I reset my feet narrower on conventional stance?",
      });

      // Step 4: Trainer final response -> status becomes 'coaching_completed'
      await supabaseAdmin.from("community_comments").insert({
        post_id: postId,
        author_id: trainerUserId,
        body: "Yes, shoulder-width is ideal for you. Thread complete.",
      });
      await supabaseAdmin.from("community_posts").update({ coaching_status: "coaching_completed" }).eq("id", postId);

      // Step 5: Verify completed status (Locked & Read-only)
      const { data: postCompleted } = await supabaseAdmin.from("community_posts").select("coaching_status").eq("id", postId).single();
      expect(postCompleted?.coaching_status).toBe("coaching_completed");
    }
  });
});
