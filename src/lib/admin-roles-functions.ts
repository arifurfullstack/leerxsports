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

export type UserRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  roles: string[];
  is_demo: boolean;
};

export const adminSearchUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { query: string }) => ({ query: (d?.query ?? "").trim() }))
  .handler(async ({ data, context }): Promise<UserRow[]> => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const q = data.query;

    // Search profiles by username / display_name / full_name (case-insensitive)
    let profilesQuery = (supabaseAdmin as any)
      .from("profiles")
      .select("user_id, username, display_name, full_name, avatar_url, is_demo")
      .order("created_at", { ascending: false })
      .limit(50);

    if (q.length > 0) {
      const pat = `%${q}%`;
      profilesQuery = profilesQuery.or(
        `username.ilike.${pat},display_name.ilike.${pat},full_name.ilike.${pat}`,
      );
    }

    const { data: profiles, error } = await profilesQuery;
    if (error) throw new Error(error.message);

    const rows = (profiles ?? []) as {
      user_id: string;
      username: string | null;
      display_name: string | null;
      full_name: string | null;
      avatar_url: string | null;
      is_demo: boolean | null;
    }[];

    // If we still have room and the query looks like an email, look users up
    // directly via the auth admin API and merge in any not already found.
    const knownIds = new Set(rows.map((r) => r.user_id));
    if (q.length > 0) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      const matches = (list?.users ?? []).filter((u) =>
        (u.email ?? "").toLowerCase().includes(q.toLowerCase()),
      );
      for (const u of matches) {
        if (knownIds.has(u.id)) continue;
        rows.push({
          user_id: u.id,
          username: null,
          display_name: null,
          full_name: (u.user_metadata as any)?.full_name ?? null,
          avatar_url: (u.user_metadata as any)?.avatar_url ?? null,
          is_demo: false,
        });
        knownIds.add(u.id);
      }
    }

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.user_id);

    // Pull roles for those users
    const { data: roleRows, error: rErr } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids);
    if (rErr) throw new Error(rErr.message);

    const rolesByUser = new Map<string, string[]>();
    for (const rr of (roleRows ?? []) as { user_id: string; role: string }[]) {
      const arr = rolesByUser.get(rr.user_id) ?? [];
      arr.push(rr.role);
      rolesByUser.set(rr.user_id, arr);
    }

    // Fetch emails from auth admin
    const emailByUser = new Map<string, string | null>();
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    for (const u of usersList?.users ?? []) {
      emailByUser.set(u.id, u.email ?? null);
    }

    return rows.map((r) => ({
      user_id: r.user_id,
      username: r.username,
      display_name: r.display_name ?? r.full_name,
      avatar_url: r.avatar_url,
      email: emailByUser.get(r.user_id) ?? null,
      roles: rolesByUser.get(r.user_id) ?? [],
      is_demo: !!r.is_demo,
    }));
  });

export const adminPromoteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => {
    if (!d?.userId) throw new Error("userId required");
    return { userId: d.userId };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("user_roles")
      .upsert(
        { user_id: data.userId, role: "admin" },
        { onConflict: "user_id, role" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminListAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserRow[]> => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roleRows, error: rErr } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("user_id, created_at")
      .eq("role", "admin")
      .order("created_at", { ascending: true });
    if (rErr) throw new Error(rErr.message);

    const ids = ((roleRows ?? []) as { user_id: string }[]).map((r) => r.user_id);
    if (ids.length === 0) return [];

    const { data: profiles, error: pErr } = await (supabaseAdmin as any)
      .from("profiles")
      .select("user_id, username, display_name, full_name, avatar_url, is_demo")
      .in("user_id", ids);
    if (pErr) throw new Error(pErr.message);

    const byId = new Map<string, any>();
    for (const p of (profiles ?? []) as any[]) byId.set(p.user_id, p);

    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const emailById = new Map<string, string | null>();
    for (const u of usersList?.users ?? []) emailById.set(u.id, u.email ?? null);

    return ids.map((id) => {
      const p = byId.get(id) ?? {};
      return {
        user_id: id,
        username: p.username ?? null,
        display_name: p.display_name ?? p.full_name ?? null,
        avatar_url: p.avatar_url ?? null,
        email: emailById.get(id) ?? null,
        roles: ["admin"],
        is_demo: !!p.is_demo,
      };
    });
  });

export const adminDemoteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => {
    if (!d?.userId) throw new Error("userId required");
    return { userId: d.userId };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("You cannot remove your own admin role.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
