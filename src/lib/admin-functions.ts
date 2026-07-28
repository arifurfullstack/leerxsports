import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { appRoleSchema } from "./schemas";

type AdminContext = {
  supabase: any;
  userId: string;
};

async function requireAdmin(context: AdminContext) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Forbidden: admin access required");
}

export const adminGetUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(error.message);
    return (
      data.users?.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
      })) ?? []
    );
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z.object({ userId: z.string().uuid(), role: appRoleSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id, role" });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminListTrainerApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("trainer_applications")
      .select(
        "id, user_id, status, public_trainer_name, full_legal_name, country, specialties, biography, certification_details, certificates, requested_price, admin_notes, created_at, updated_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminReviewTrainerApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        applicationId: z.string().uuid(),
        decision: z.enum(["approved", "rejected", "resubmit"]),
        notes: z.string().max(2000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: app, error: appErr } = await supabaseAdmin
      .from("trainer_applications")
      .select(
        "id, user_id, public_trainer_name, specialties, biography, requested_price",
      )
      .eq("id", data.applicationId)
      .maybeSingle();
    if (appErr) throw new Error(appErr.message);
    if (!app) throw new Error("Application not found.");

    const { error: updErr } = await supabaseAdmin
      .from("trainer_applications")
      .update({
        status: data.decision,
        admin_notes: data.notes ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("id", data.applicationId);
    if (updErr) throw new Error(updErr.message);

    if (data.decision === "approved") {
      // Grant trainer role
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: app.user_id, role: "trainer" },
          { onConflict: "user_id, role" },
        );
      if (roleErr) throw new Error(roleErr.message);

      // Create trainer profile
      const { error: tpErr } = await supabaseAdmin
        .from("trainer_profiles")
        .upsert(
          {
            user_id: app.user_id,
            specialties: app.specialties ?? [],
            value_proposition: (app.biography ?? "").slice(0, 200),
            subscription_price: app.requested_price ?? 9.99,
            is_verified: true,
            monetization_enabled: true,
          },
          { onConflict: "user_id" },
        );
      if (tpErr) throw new Error(tpErr.message);
    }

    return { ok: true };
  });
