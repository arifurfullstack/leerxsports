import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { appRoleSchema } from "./schemas";

export const getUserRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // A user can legitimately hold multiple roles (e.g. admin + trainee).
    // Fetch all rows and return the highest-priority role rather than
    // using .single()/.maybeSingle(), which throws when >1 row exists.
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    const roles = (data ?? []).map((r) => r.role);
    const priority = ["admin", "moderator", "trainer", "user", "trainee"] as const;
    const best = priority.find((p) => roles.includes(p)) ?? "trainee";
    return appRoleSchema.parse(best);
  });

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdminRole, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    return !!isAdminRole;
  });
