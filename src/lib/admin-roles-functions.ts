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
  is_verified: boolean;
  banned: boolean;
};

export const adminSearchUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { query: string }) => ({ query: (d?.query ?? "").trim() }))
  .handler(async ({ data, context }): Promise<UserRow[]> => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const q = data.query;

    // Search profiles by username / display_name / full_name (case-insensitive)
    let profilesQuery = (supabaseAdmin as any)
      .from("profiles")
      .select("user_id, username, display_name, full_name, avatar_url, is_demo, is_verified")
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
      is_verified: boolean | null;
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
          is_verified: false,
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

    // Fetch emails + banned state from auth admin
    const emailByUser = new Map<string, string | null>();
    const bannedByUser = new Map<string, boolean>();
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    for (const u of usersList?.users ?? []) {
      emailByUser.set(u.id, u.email ?? null);
      const bu = (u as any).banned_until as string | null | undefined;
      bannedByUser.set(u.id, !!bu && new Date(bu).getTime() > Date.now());
    }

    return rows.map((r) => ({
      user_id: r.user_id,
      username: r.username,
      display_name: r.display_name ?? r.full_name,
      avatar_url: r.avatar_url,
      email: emailByUser.get(r.user_id) ?? null,
      roles: rolesByUser.get(r.user_id) ?? [],
      is_demo: !!r.is_demo,
      is_verified: !!r.is_verified,
      banned: !!bannedByUser.get(r.user_id),
    }));
  });

export const adminPromoteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { userId: string }) => {
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
      .select("user_id, username, display_name, full_name, avatar_url, is_demo, is_verified")
      .in("user_id", ids);
    if (pErr) throw new Error(pErr.message);

    const byId = new Map<string, any>();
    for (const p of (profiles ?? []) as any[]) byId.set(p.user_id, p);

    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const emailById = new Map<string, string | null>();
    const bannedById = new Map<string, boolean>();
    for (const u of usersList?.users ?? []) {
      emailById.set(u.id, u.email ?? null);
      const bu = (u as any).banned_until as string | null | undefined;
      bannedById.set(u.id, !!bu && new Date(bu).getTime() > Date.now());
    }

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
        is_verified: !!p.is_verified,
        banned: !!bannedById.get(id),
      };
    });
  });

export function assertCannotDemoteSelf(
  actorId: string,
  targetUserId: string,
  nextRoles?: string[] | null,
) {
  if (actorId !== targetUserId) return;
  if (!nextRoles || !nextRoles.includes("admin")) {
    throw new Error("You cannot remove your own admin role.");
  }
}

export const adminDemoteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { userId: string }) => {
    if (!d?.userId) throw new Error("userId required");
    return { userId: d.userId };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    assertCannotDemoteSelf(context.userId, data.userId, []);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export type AdminEditUserInput = {
  userId: string;
  email?: string | null;
  password?: string | null;
  username?: string | null;
  displayName?: string | null;
  fullName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  isDemo?: boolean | null;
  isVerified?: boolean | null;
  roles?: string[] | null;
  banned?: boolean | null;
};

const ALLOWED_ROLES = new Set(["admin", "trainer", "trainee", "moderator"]);

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: AdminEditUserInput) => {
    if (!d?.userId) throw new Error("userId required");
    if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) throw new Error("Invalid email");
    if (d.password && d.password.length > 0 && d.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    if (d.username && !/^[a-zA-Z0-9_.]{2,30}$/.test(d.username)) {
      throw new Error("Username must be 2-30 chars: letters, numbers, _ or .");
    }
    if (d.roles) {
      for (const r of d.roles) {
        if (!ALLOWED_ROLES.has(r)) throw new Error(`Invalid role: ${r}`);
      }
    }
    return d;
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Auth updates (email / password / ban)
    const authAttrs: Record<string, unknown> = {};
    if (data.email) authAttrs.email = data.email;
    if (data.password && data.password.length > 0) authAttrs.password = data.password;
    if (typeof data.banned === "boolean") {
      authAttrs.ban_duration = data.banned ? "876000h" : "none";
    }
    if (Object.keys(authAttrs).length > 0) {
      const { error: aErr } = await supabaseAdmin.auth.admin.updateUserById(
        data.userId,
        authAttrs as any,
      );
      if (aErr) throw new Error(aErr.message);
    }

    // Profile updates
    const profilePatch: Record<string, unknown> = {};
    if (data.username !== undefined) profilePatch.username = data.username;
    if (data.displayName !== undefined) profilePatch.display_name = data.displayName;
    if (data.fullName !== undefined) profilePatch.full_name = data.fullName;
    if (data.bio !== undefined) profilePatch.bio = data.bio;
    if (data.avatarUrl !== undefined) profilePatch.avatar_url = data.avatarUrl;
    if (typeof data.isDemo === "boolean") profilePatch.is_demo = data.isDemo;
    if (typeof data.isVerified === "boolean") {
      profilePatch.is_verified = data.isVerified;
      profilePatch.verified_at = data.isVerified ? new Date().toISOString() : null;
      profilePatch.verified_by = data.isVerified ? context.userId : null;
    }

    if (Object.keys(profilePatch).length > 0) {
      const { error: pErr } = await (supabaseAdmin as any)
        .from("profiles")
        .update(profilePatch)
        .eq("user_id", data.userId);
      if (pErr) throw new Error(pErr.message);
    }

    // Role replacement
    if (data.roles) {
      const nextRoles = Array.from(new Set(data.roles));
      assertCannotDemoteSelf(context.userId, data.userId, nextRoles);
      const { data: existing, error: exErr } = await (supabaseAdmin as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", data.userId);
      if (exErr) throw new Error(exErr.message);
      const current = new Set(((existing ?? []) as { role: string }[]).map((r) => r.role));
      const target = new Set(nextRoles);
      const toAdd = [...target].filter((r) => !current.has(r));
      const toRemove = [...current].filter((r) => !target.has(r));
      if (toRemove.length > 0) {
        const { error: dErr } = await (supabaseAdmin as any)
          .from("user_roles")
          .delete()
          .eq("user_id", data.userId)
          .in("role", toRemove);
        if (dErr) throw new Error(dErr.message);
      }
      if (toAdd.length > 0) {
        const { error: iErr } = await (supabaseAdmin as any)
          .from("user_roles")
          .insert(toAdd.map((role) => ({ user_id: data.userId, role })));
        if (iErr) throw new Error(iErr.message);
      }
    }

    return { ok: true as const };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { userId: string }) => {
    if (!d?.userId) throw new Error("userId required");
    return { userId: d.userId };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("You cannot delete your own account.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export type BulkAction =
  | "add_role"
  | "remove_role"
  | "verify"
  | "unverify"
  | "ban"
  | "unban"
  | "reset_password"
  | "delete";

export type BulkResult = {
  succeeded: string[];
  failed: { userId: string; error: string }[];
  passwords?: { userId: string; email: string | null; password: string }[];
};

function randomPassword(len = 14) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

export const adminBulkUserAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { userIds: string[]; action: BulkAction; role?: string }) => {
    if (!Array.isArray(d?.userIds) || d.userIds.length === 0) {
      throw new Error("Select at least one user");
    }
    if (d.userIds.length > 200) throw new Error("Too many users (max 200)");
    const actions: BulkAction[] = [
      "add_role", "remove_role", "verify", "unverify",
      "ban", "unban", "reset_password", "delete",
    ];
    if (!actions.includes(d.action)) throw new Error("Invalid action");
    if ((d.action === "add_role" || d.action === "remove_role")) {
      if (!d.role || !ALLOWED_ROLES.has(d.role)) throw new Error("Invalid role");
    }
    return d;
  })
  .handler(async ({ data, context }): Promise<BulkResult> => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ids = Array.from(new Set(data.userIds));
    const succeeded: string[] = [];
    const failed: { userId: string; error: string }[] = [];
    const passwords: { userId: string; email: string | null; password: string }[] = [];

    for (const uid of ids) {
      try {
        if ((data.action === "delete"
          || (data.action === "remove_role" && data.role === "admin")
          || data.action === "ban")
          && uid === context.userId) {
          throw new Error("Cannot apply to your own account");
        }

        switch (data.action) {
          case "add_role": {
            const { error } = await (supabaseAdmin as any)
              .from("user_roles")
              .upsert({ user_id: uid, role: data.role! }, { onConflict: "user_id, role" });
            if (error) throw new Error(error.message);
            break;
          }
          case "remove_role": {
            const { error } = await (supabaseAdmin as any)
              .from("user_roles")
              .delete()
              .eq("user_id", uid)
              .eq("role", data.role!);
            if (error) throw new Error(error.message);
            break;
          }
          case "verify":
          case "unverify": {
            const verified = data.action === "verify";
            const { error } = await (supabaseAdmin as any)
              .from("profiles")
              .update({
                is_verified: verified,
                verified_at: verified ? new Date().toISOString() : null,
                verified_by: verified ? context.userId : null,
              })
              .eq("user_id", uid);
            if (error) throw new Error(error.message);
            break;
          }
          case "ban":
          case "unban": {
            const { error } = await supabaseAdmin.auth.admin.updateUserById(uid, {
              ban_duration: data.action === "ban" ? "876000h" : "none",
            } as any);
            if (error) throw new Error(error.message);
            break;
          }
          case "reset_password": {
            const pw = randomPassword();
            const { data: upd, error } = await supabaseAdmin.auth.admin.updateUserById(uid, {
              password: pw,
            });
            if (error) throw new Error(error.message);
            passwords.push({ userId: uid, email: upd?.user?.email ?? null, password: pw });
            break;
          }
          case "delete": {
            const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
            if (error) throw new Error(error.message);
            break;
          }
        }
        succeeded.push(uid);
      } catch (e: any) {
        failed.push({ userId: uid, error: e?.message ?? "Unknown error" });
      }
    }

    return { succeeded, failed, passwords: passwords.length ? passwords : undefined };
  });
