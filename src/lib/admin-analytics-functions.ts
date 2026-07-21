import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin access required");
}

async function countRows(admin: any, table: string, filter?: (q: any) => any) {
  let q = admin.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

export const adminGetOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since7 = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const since30 = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
    const nowIso = new Date().toISOString();

    const [
      users,
      newUsers7,
      trainers,
      admins,
      trainerApps,
      pendingApps,
      classes,
      bookings,
      bookings7,
      posts,
      transformations,
      communityPosts,
      activeSubs,
      subs7,
      openReports,
      openDisputes,
      strikes,
      coachingReqs,
      hiddenPosts,
    ] = await Promise.all([
      countRows(supabaseAdmin, "profiles"),
      countRows(supabaseAdmin, "profiles", (q) => q.gte("created_at", since7)),
      countRows(supabaseAdmin, "user_roles", (q) => q.eq("role", "trainer")),
      countRows(supabaseAdmin, "user_roles", (q) => q.eq("role", "admin")),
      countRows(supabaseAdmin, "trainer_applications"),
      countRows(supabaseAdmin, "trainer_applications", (q) =>
        q.in("status", ["pending", "resubmit"]),
      ),
      countRows(supabaseAdmin, "sports_classes"),
      countRows(supabaseAdmin, "bookings"),
      countRows(supabaseAdmin, "bookings", (q) => q.gte("booked_at", since7)),
      countRows(supabaseAdmin, "posts"),
      countRows(supabaseAdmin, "transformation_posts"),
      countRows(supabaseAdmin, "community_posts"),
      countRows(supabaseAdmin, "subscriptions", (q) =>
        q.in("status", ["active", "trial", "grace"]).gt("current_period_end", nowIso),
      ),
      countRows(supabaseAdmin, "subscriptions", (q) => q.gte("created_at", since7)),
      countRows(supabaseAdmin, "reports", (q) => q.in("status", ["open", "reviewed"])),
      countRows(supabaseAdmin, "coaching_disputes", (q) => q.eq("status", "open")),
      countRows(supabaseAdmin, "trainer_strikes", (q) => q.is("revoked_at", null)),
      countRows(supabaseAdmin, "coaching_requests"),
      countRows(supabaseAdmin, "posts", (q) => q.eq("is_hidden", true)),
    ]);

    // Tips totals (last 30d + all-time)
    const [{ data: tipsAll }, { data: tips30 }] = await Promise.all([
      supabaseAdmin.from("tips").select("amount"),
      supabaseAdmin.from("tips").select("amount").gte("created_at", since30),
    ]);
    const sum = (rows: { amount: number | string | null }[] | null) =>
      (rows ?? []).reduce((a, r) => a + Number(r.amount ?? 0), 0);
    const tipsTotal = sum(tipsAll);
    const tips30Total = sum(tips30);

    return {
      users,
      newUsers7,
      trainers,
      admins,
      trainerApps,
      pendingApps,
      classes,
      bookings,
      bookings7,
      posts,
      transformations,
      communityPosts,
      activeSubs,
      subs7,
      openReports,
      openDisputes,
      strikes,
      coachingReqs,
      hiddenPosts,
      tipsTotal,
      tips30Total,
    };
  });

export const adminGetSignupSeries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const buckets = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600_000).toISOString().slice(0, 10);
      buckets.set(d, 0);
    }
    for (const row of data ?? []) {
      const day = String(row.created_at).slice(0, 10);
      if (buckets.has(day)) buckets.set(day, (buckets.get(day) ?? 0) + 1);
    }
    return Array.from(buckets, ([date, count]) => ({ date, count }));
  });

export const adminGetRecentActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [reports, apps, bookings, subs] = await Promise.all([
      supabaseAdmin
        .from("reports")
        .select("id, target_type, reason, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdmin
        .from("trainer_applications")
        .select("id, public_trainer_name, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdmin
        .from("bookings")
        .select("id, class_id, status, booked_at")
        .order("booked_at", { ascending: false })
        .limit(5),
      supabaseAdmin
        .from("subscriptions")
        .select("id, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    return {
      reports: reports.data ?? [],
      apps: apps.data ?? [],
      bookings: bookings.data ?? [],
      subs: subs.data ?? [],
    };
  });