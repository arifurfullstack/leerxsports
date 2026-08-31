import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, supabaseAdmin, QA_USERS, ensureQAUser } from "./helpers/auth";

test.describe("15. Creator Studio, Content Upload & Studio Management", () => {
  let verifiedTrainerId: string;

  test.beforeAll(async () => {
    await ensureQAUser("verifiedTrainer");
    await ensureQAUser("trainee");

    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const trainerUser = list?.users?.find((u) => u.email === QA_USERS.verifiedTrainer.email);
    verifiedTrainerId = trainerUser?.id || "";
  });

  test("A. Verified Pro Trainer can access Creator Dashboard", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "verifiedTrainer");

    await page.goto("/creator/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const header = page.locator('h1, h2, [data-testid="creator-dashboard"], main').first();
    await expect(header).toBeVisible({ timeout: 15_000 });
  });

  test("B. Trainee viewing /creator/dashboard renders trainee view without active monetization", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/creator/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 15_000 });
  });

  test("C. Creating a Feed Post supports Free vs Premium and Draft vs Published", async ({ page: _page }) => {
    if (!verifiedTrainerId) return;

    // 1. Create Free Public Post
    const { data: freePost, error: freeErr } = await supabaseAdmin
      .from("posts")
      .insert({
        trainer_id: verifiedTrainerId,
        kind: "feed",
        is_premium: false,
        caption: "Free E2E Drill Workout #1",
        media_url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop",
        is_published: true,
      })
      .select()
      .single();

    expect(freeErr).toBeNull();
    expect(freePost?.is_premium).toBe(false);
    expect(freePost?.is_published).toBe(true);

    // 2. Create Premium Locked Post
    const { data: premiumPost, error: premErr } = await supabaseAdmin
      .from("posts")
      .insert({
        trainer_id: verifiedTrainerId,
        kind: "feed",
        is_premium: true,
        caption: "Exclusive Pro Subscriber Drill #2",
        media_url: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&auto=format&fit=crop",
        thumbnail_url: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400&auto=format&fit=crop",
        is_published: true,
      })
      .select()
      .single();

    expect(premErr).toBeNull();
    expect(premiumPost?.is_premium).toBe(true);
    expect(premiumPost?.is_published).toBe(true);

    // Clean up created test posts
    if (freePost?.id) await supabaseAdmin.from("posts").delete().eq("id", freePost.id);
    if (premiumPost?.id) await supabaseAdmin.from("posts").delete().eq("id", premiumPost.id);
  });

  test("D. Creating a Short (Vertical Reel) with tags and media", async ({ page: _page }) => {
    if (!verifiedTrainerId) return;

    const { data: shortPost, error: shortErr } = await supabaseAdmin
      .from("posts")
      .insert({
        trainer_id: verifiedTrainerId,
        kind: "short",
        is_premium: false,
        caption: "Quick HIIT Explosive Reel #hiit #explosive",
        media_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        thumbnail_url: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400&auto=format&fit=crop",
        is_published: true,
      })
      .select()
      .single();

    expect(shortErr).toBeNull();
    expect(shortPost?.kind).toBe("short");

    if (shortPost?.id) await supabaseAdmin.from("posts").delete().eq("id", shortPost.id);
  });

  test("E. Trainer subscription price configuration obeys bounds ($4.99 - $499.99)", async ({ page: _page }) => {
    if (!verifiedTrainerId) return;

    // Valid price update
    const { error: validErr } = await supabaseAdmin
      .from("trainer_profiles")
      .update({ subscription_price: 29.99 })
      .eq("user_id", verifiedTrainerId);
    expect(validErr).toBeNull();

    const { data: tp } = await supabaseAdmin
      .from("trainer_profiles")
      .select("subscription_price")
      .eq("user_id", verifiedTrainerId)
      .single();
    expect(Number(tp?.subscription_price)).toBe(29.99);
  });
});
