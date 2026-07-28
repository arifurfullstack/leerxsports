import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const rangeSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function daysArray(start: string, end: string): string[] {
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  const out: string[] = [];
  const step = 24 * 3600_000;
  const from = Math.min(s, e);
  const to = Math.max(s, e);
  for (let t = from; t <= to; t += step) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  // Safety cap: no more than 366 buckets
  return out.slice(-366);
}

function rangeBounds(start: string, end: string) {
  const days = daysArray(start, end);
  const first = days[0]!;
  const last = days[days.length - 1]!;
  const startIso = new Date(`${first}T00:00:00Z`).toISOString();
  const endIso = new Date(`${last}T23:59:59.999Z`).toISOString();
  return { days, startIso, endIso };
}

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
      posts,
      transformations,
      communityPosts,
      activeSubs,
      subs7,
      openReports,
      strikes,
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
      countRows(supabaseAdmin, "posts"),
      countRows(supabaseAdmin, "transformation_posts"),
      countRows(supabaseAdmin, "community_posts"),
      countRows(supabaseAdmin, "subscriptions", (q) =>
        q.in("status", ["active", "trial", "grace"]).gt("current_period_end", nowIso),
      ),
      countRows(supabaseAdmin, "subscriptions", (q) => q.gte("created_at", since7)),
      countRows(supabaseAdmin, "reports", (q) => q.in("status", ["open", "reviewed"])),
      countRows(supabaseAdmin, "trainer_strikes", (q) => q.is("revoked_at", null)),
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
      posts,
      transformations,
      communityPosts,
      activeSubs,
      subs7,
      openReports,
      strikes,
      hiddenPosts,
      tipsTotal,
      tips30Total,
    };
  });

export const adminGetSignupSeries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => rangeSchema.parse(data))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { days, startIso, endIso } = rangeBounds(data.start, data.end);
    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("created_at")
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const buckets = new Map<string, number>();
    for (const d of days) buckets.set(d, 0);
    for (const row of rows ?? []) {
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
    const [reports, apps, subs] = await Promise.all([
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
        .from("subscriptions")
        .select("id, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    return {
      reports: reports.data ?? [],
      apps: apps.data ?? [],
      subs: subs.data ?? [],
    };
  });

function bucketByDay(rows: { created_at: string | null }[] | null, days: string[]) {
  const buckets = new Map<string, number>();
  for (const d of days) buckets.set(d, 0);
  for (const row of rows ?? []) {
    if (!row.created_at) continue;
    const day = String(row.created_at).slice(0, 10);
    if (buckets.has(day)) buckets.set(day, (buckets.get(day) ?? 0) + 1);
  }
  return Array.from(buckets, ([date, count]) => ({ date, count }));
}

function bucketAmountByDay(
  rows: { created_at: string | null; amount: number | string | null }[] | null,
  days: string[],
) {
  const buckets = new Map<string, number>();
  for (const d of days) buckets.set(d, 0);
  for (const row of rows ?? []) {
    if (!row.created_at) continue;
    const day = String(row.created_at).slice(0, 10);
    if (buckets.has(day))
      buckets.set(day, (buckets.get(day) ?? 0) + Number(row.amount ?? 0));
  }
  return Array.from(buckets, ([date, amount]) => ({ date, amount }));
}

export const adminGetDashboardExtras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => rangeSchema.parse(data))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { days, startIso, endIso } = rangeBounds(data.start, data.end);

    const [
      postSeriesRes,
      subSeriesRes,
      tipsSeriesRes,
      reportsBreakdownRes,
      rolesRes,
      topTrainersRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("posts")
        .select("created_at")
        .gte("created_at", startIso)
        .lte("created_at", endIso),
      supabaseAdmin
        .from("subscriptions")
        .select("created_at")
        .gte("created_at", startIso)
        .lte("created_at", endIso),
      supabaseAdmin
        .from("tips")
        .select("created_at, amount")
        .gte("created_at", startIso)
        .lte("created_at", endIso),
      supabaseAdmin
        .from("reports")
        .select("reason, status")
        .in("status", ["open", "reviewed"]),
      supabaseAdmin.from("user_roles").select("role"),
      supabaseAdmin
        .from("trainer_profiles")
        .select(
          "user_id, follower_count, subscriber_count, profiles:user_id(username, display_name, avatar_url)",
        )
        .order("subscriber_count", { ascending: false })
        .limit(5),
    ]);

    const postSeries = bucketByDay(postSeriesRes.data, days);
    const subSeries = bucketByDay(subSeriesRes.data, days);
    const tipsSeries = bucketAmountByDay(tipsSeriesRes.data, days);

    const reasonMap = new Map<string, number>();
    for (const r of reportsBreakdownRes.data ?? []) {
      const k = r.reason ?? "other";
      reasonMap.set(k, (reasonMap.get(k) ?? 0) + 1);
    }
    const reportsByReason = Array.from(reasonMap, ([reason, count]) => ({
      reason,
      count,
    })).sort((a, b) => b.count - a.count);

    const roleMap = new Map<string, number>();
    for (const r of rolesRes.data ?? []) {
      const k = (r as { role: string }).role;
      roleMap.set(k, (roleMap.get(k) ?? 0) + 1);
    }
    const roles = Array.from(roleMap, ([role, count]) => ({ role, count }));

    const topTrainers = (topTrainersRes.data ?? []).map((t: any) => ({
      user_id: t.user_id,
      followers: Number(t.follower_count ?? 0),
      subscribers: Number(t.subscriber_count ?? 0),
      username: t.profiles?.username ?? null,
      display_name: t.profiles?.display_name ?? null,
      avatar_url: t.profiles?.avatar_url ?? null,
    }));

    return {
      postSeries,
      subSeries,
      tipsSeries,
      reportsByReason,
      roles,
      topTrainers,
    };
  });