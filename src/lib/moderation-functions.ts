import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const REPORT_TARGETS = [
  "post",
  "comment",
  "community_post",
  "community_comment",
  "profile",
  "coaching_thread",
  "transformation",
  "short",
] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_REASONS = [
  "nudity",
  "abuse",
  "spam",
  "misinformation",
  "ip_violation",
  "self_harm",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

const reportSchema = z.object({
  target_type: z.enum(REPORT_TARGETS),
  target_id: z.string().uuid(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(1000).optional(),
});

/** Submit a report on any moderable target. Reporter is the current user. */
export const submitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => reportSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("reports").insert({
      reporter_id: context.userId,
      target_type: data.target_type,
      target_id: data.target_id,
      reason: data.reason,
      details: data.details ?? null,
    });
    if (error) {
      if (error.code === "23505") {
        return { ok: true, duplicate: true as const, autoHidden: false };
      }
      throw new Error(error.message);
    }

    // 13.2 Report Threshold Evaluation & Auto-Hide
    // Serious flags (nudity, abuse, self_harm) hide immediately at 1 report.
    // General flags (spam, misinformation, etc.) hide at 3 reports.
    let autoHidden = false;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { count } = await supabaseAdmin
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("target_type", data.target_type)
        .eq("target_id", data.target_id);

      const isSeriousFlag = data.reason === "nudity" || data.reason === "abuse" || data.reason === "self_harm";
      const threshold = isSeriousFlag ? 1 : 3;

      if ((count ?? 1) >= threshold) {
        autoHidden = true;

        if (data.target_type === "post" || data.target_type === "short") {
          await supabaseAdmin.from("posts").update({ is_hidden: true }).eq("id", data.target_id);
        } else if (data.target_type === "transformation") {
          await supabaseAdmin.from("transformation_posts").update({ is_hidden: true }).eq("id", data.target_id);
        } else if (data.target_type === "community_post") {
          await supabaseAdmin.from("community_posts").update({ status: "hidden" }).eq("id", data.target_id);
        } else if (data.target_type === "community_comment") {
          await supabaseAdmin.from("community_comments").update({ status: "hidden" }).eq("id", data.target_id);
        } else if (data.target_type === "comment") {
          await supabaseAdmin.from("comments").update({ status: "hidden" }).eq("id", data.target_id);
        }

        // Log system moderation action
        await supabaseAdmin.from("moderation_actions").insert({
          actor_id: context.userId,
          target_type: data.target_type,
          target_id: data.target_id,
          action: "hide",
          reason: `System Auto-Hide: Report threshold reached (${count ?? 1} report(s), reason: ${data.reason})`,
        });
      }
    } catch (autoErr) {
      console.error("Auto-hide threshold evaluation error:", autoErr);
    }

    return { ok: true, duplicate: false as const, autoHidden };
  });

export type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: ReportTarget;
  target_id: string;
  reason: ReportReason;
  details: string | null;
  status: "open" | "reviewed" | "actioned" | "dismissed";
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Forbidden: admin access required");
}

export const adminListReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReportRow[]> => {
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("reports")
      .select(
        "id, reporter_id, target_type, target_id, reason, details, status, resolution_note, created_at, resolved_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as ReportRow[];
  });

export const adminHideTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        target_type: z.enum(REPORT_TARGETS),
        target_id: z.string().uuid(),
        action: z.enum(["hide", "restore", "remove"]),
        reason: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const setState =
      data.action === "hide"
        ? true
        : data.action === "restore"
          ? false
          : null; // remove -> delete row

    if (data.target_type === "post") {
      if (data.action === "remove") {
        await supabaseAdmin.from("posts").delete().eq("id", data.target_id);
      } else {
        await supabaseAdmin
          .from("posts")
          .update({ is_hidden: setState === true })
          .eq("id", data.target_id);
      }
    } else if (data.target_type === "transformation") {
      if (data.action === "remove") {
        await supabaseAdmin.from("transformation_posts").delete().eq("id", data.target_id);
      } else {
        await supabaseAdmin
          .from("transformation_posts")
          .update({ is_hidden: setState === true })
          .eq("id", data.target_id);
      }
    } else if (data.target_type === "community_post") {
      if (data.action === "remove") {
        await supabaseAdmin
          .from("community_posts")
          .update({ status: "removed" })
          .eq("id", data.target_id);
      } else {
        await supabaseAdmin
          .from("community_posts")
          .update({ status: setState ? "hidden" : "visible" })
          .eq("id", data.target_id);
      }
    } else if (data.target_type === "community_comment") {
      await supabaseAdmin
        .from("community_comments")
        .update({
          status:
            data.action === "remove"
              ? "deleted"
              : setState
                ? "hidden"
                : "visible",
        })
        .eq("id", data.target_id);
    } else if (data.target_type === "comment") {
      await supabaseAdmin
        .from("comments")
        .update({
          status:
            data.action === "remove"
              ? "deleted"
              : setState
                ? "hidden"
                : "visible",
        })
        .eq("id", data.target_id);
    }

    await supabaseAdmin.from("moderation_actions").insert({
      actor_id: context.userId,
      target_type: data.target_type,
      target_id: data.target_id,
      action: data.action,
      reason: data.reason ?? null,
    });

    return { ok: true };
  });

export const adminResolveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        reportId: z.string().uuid(),
        status: z.enum(["reviewed", "actioned", "dismissed"]),
        note: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("reports")
      .update({
        status: data.status,
        resolution_note: data.note ?? null,
        resolved_by: context.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.reportId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Trainer strike: hidden yellow card. Auto-triggers ban prompt at 3 active. */
export const adminIssueStrike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        trainerId: z.string().uuid(),
        reason: z.string().min(3).max(500),
        disputeId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("trainer_strikes").insert({
      trainer_id: data.trainerId,
      reason: data.reason,
      dispute_id: data.disputeId ?? null,
      issued_by: context.userId,
      status: "active",
    });
    if (error) throw new Error(error.message);

    // Recount active strikes and mirror onto trainer_profiles.
    const { count } = await supabaseAdmin
      .from("trainer_strikes")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", data.trainerId)
      .eq("status", "active");
    await supabaseAdmin
      .from("trainer_profiles")
      .update({ strike_count: count ?? 0 })
      .eq("user_id", data.trainerId);

    return { ok: true, activeCount: count ?? 0 };
  });

export const adminListStrikes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("trainer_strikes")
      .select("id, trainer_id, reason, status, created_at, dispute_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminRevokeStrike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("trainer_strikes")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .select("trainer_id")
      .single();
    if (error) throw new Error(error.message);
    const { count } = await supabaseAdmin
      .from("trainer_strikes")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", row.trainer_id)
      .eq("status", "active");
    await supabaseAdmin
      .from("trainer_profiles")
      .update({ strike_count: count ?? 0 })
      .eq("user_id", row.trainer_id);
    return { ok: true };
  });

