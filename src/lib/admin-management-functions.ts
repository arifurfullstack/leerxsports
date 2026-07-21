import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AuthedCtx = { supabase: any; userId: string };

async function requireModOrAdmin(context: AuthedCtx): Promise<"admin" | "moderator"> {
  const [{ data: a }, { data: m }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "moderator" }),
  ]);
  if (a) return "admin";
  if (m) return "moderator";
  throw new Error("Forbidden: admin or moderator required");
}

async function requireAdmin(context: AuthedCtx) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden: admin required");
}

/** Generic paged list for management pages. Returns raw rows. */
export const adminListRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      table: string;
      select?: string;
      orderBy?: string;
      ascending?: boolean;
      limit?: number;
      search?: { column: string; value: string } | null;
      filter?: { column: string; value: string } | null;
    }) => ({
      table: String(d.table),
      select: d.select ?? "*",
      orderBy: d.orderBy ?? "created_at",
      ascending: d.ascending ?? false,
      limit: Math.min(Math.max(d.limit ?? 100, 1), 500),
      search: d.search ?? null,
      filter: d.filter ?? null,
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModOrAdmin(context);
    const ALLOWED = new Set([
      "posts",
      "comments",
      "community_posts",
      "community_comments",
      "transformation_posts",
      "subscriptions",
      "transactions",
      "coaching_requests",
      "notifications",
      "tips",
      "trainer_balances",
      "payouts",
      "trainer_strikes",
      "moderation_actions",
      "audit_logs",
      "countries",
      "languages",
      "fitness_categories",
      "policies",
    ]);
    if (!ALLOWED.has(data.table)) throw new Error("Table not allowed");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from(data.table)
      .select(data.select)
      .order(data.orderBy, { ascending: data.ascending })
      .limit(data.limit);
    if (data.filter) q = q.eq(data.filter.column, data.filter.value);
    if (data.search && data.search.value) {
      q = q.ilike(data.search.column, `%${data.search.value}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const adminUpdateRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { table: string; id: string; patch: Record<string, unknown> }) => ({
      table: String(d.table),
      id: String(d.id),
      patch: d.patch ?? {},
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModOrAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from(data.table)
      .update(data.patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDeleteRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { table: string; id: string }) => ({
    table: String(d.table),
    id: String(d.id),
  }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from(data.table)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });