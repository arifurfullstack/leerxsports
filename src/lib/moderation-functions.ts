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
  .inputValidator((input) => reportSchema.parse(input))
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
        return { ok: true, duplicate: true as const };
      }
      throw new Error(error.message);
    }
    return { ok: true, duplicate: false as const };
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
  .inputValidator((input) =>
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
  .inputValidator((input) =>
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
  .inputValidator((input) =>
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
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
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

// ============ Coaching disputes ============

export const openCoachingDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        threadId: z.string().uuid(),
        reason: z.string().min(10).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: thread, error: tErr } = await supabase
      .from("coaching_requests")
      .select("id, subscriber_id, trainer_id, status, completed_at")
      .eq("id", data.threadId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!thread) throw new Error("Thread not found.");
    if (
      thread.subscriber_id !== userId &&
      thread.trainer_id !== userId
    ) {
      throw new Error("Only participants can open disputes.");
    }
    if (thread.status !== "coaching_completed") {
      throw new Error("Disputes can only be opened after coaching completes.");
    }

    // Enforce dispute window from platform_settings
    const { data: settings } = await supabase
      .from("platform_settings")
      .select("dispute_window_hours")
      .eq("id", true)
      .maybeSingle();
    const windowHrs = settings?.dispute_window_hours ?? 24;
    if (thread.completed_at) {
      const deadline =
        new Date(thread.completed_at).getTime() + windowHrs * 3600 * 1000;
      if (Date.now() > deadline) {
        throw new Error("Dispute window has closed.");
      }
    }

    const { data: existing } = await supabase
      .from("coaching_disputes")
      .select("id")
      .eq("thread_id", data.threadId)
      .maybeSingle();
    if (existing) throw new Error("A dispute already exists for this thread.");

    const { data: row, error } = await supabase
      .from("coaching_disputes")
      .insert({
        thread_id: data.threadId,
        opener_id: userId,
        reason: data.reason,
        status: "open",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Freeze the trainer's associated transaction (if any).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("transactions")
      .update({ status: "frozen" })
      .eq("trainer_id", thread.trainer_id)
      .eq("payer_id", thread.subscriber_id)
      .eq("kind", "tip")
      .contains("metadata", { threadId: data.threadId });

    return { ok: true, disputeId: row.id };
  });

export type AdminDisputeRow = {
  id: string;
  thread_id: string;
  opener_id: string;
  reason: string;
  status:
    | "open"
    | "under_review"
    | "resolved_trainer"
    | "resolved_trainee"
    | "withdrawn";
  verdict: string | null;
  created_at: string;
};

export const adminListDisputes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminDisputeRow[]> => {
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("coaching_disputes")
      .select("id, thread_id, opener_id, reason, status, verdict, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as AdminDisputeRow[];
  });

export const adminResolveDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        disputeId: z.string().uuid(),
        outcome: z.enum(["resolved_trainer", "resolved_trainee"]),
        verdict: z.string().max(2000).optional(),
        issueStrike: z.boolean().optional(),
        refund: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: dispute, error: dErr } = await supabaseAdmin
      .from("coaching_disputes")
      .select("id, thread_id")
      .eq("id", data.disputeId)
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);
    if (!dispute) throw new Error("Dispute not found.");

    const { data: thread } = await supabaseAdmin
      .from("coaching_requests")
      .select("id, subscriber_id, trainer_id, credit_id")
      .eq("id", dispute.thread_id)
      .maybeSingle();
    if (!thread) throw new Error("Thread not found.");

    const { error: updErr } = await supabaseAdmin
      .from("coaching_disputes")
      .update({
        status: data.outcome,
        verdict: data.verdict ?? null,
        resolved_by: context.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.disputeId);
    if (updErr) throw new Error(updErr.message);

    if (data.outcome === "resolved_trainee") {
      // Restore credit if present
      if (thread.credit_id) {
        await supabaseAdmin
          .from("feedback_credits")
          .update({ status: "available" })
          .eq("id", thread.credit_id);
      }
      // Optional refund: mark related tip transactions refunded
      if (data.refund) {
        await supabaseAdmin
          .from("transactions")
          .update({ status: "refunded" })
          .eq("trainer_id", thread.trainer_id)
          .eq("payer_id", thread.subscriber_id)
          .contains("metadata", { threadId: thread.id });
      }
      if (data.issueStrike) {
        await supabaseAdmin.from("trainer_strikes").insert({
          trainer_id: thread.trainer_id,
          reason: data.verdict ?? "Dispute resolved in favor of subscriber",
          dispute_id: data.disputeId,
          issued_by: context.userId,
          status: "active",
        });
        const { count } = await supabaseAdmin
          .from("trainer_strikes")
          .select("id", { count: "exact", head: true })
          .eq("trainer_id", thread.trainer_id)
          .eq("status", "active");
        await supabaseAdmin
          .from("trainer_profiles")
          .update({ strike_count: count ?? 0 })
          .eq("user_id", thread.trainer_id);
      }
    } else {
      // Trainer wins — unfreeze frozen transactions on this thread
      await supabaseAdmin
        .from("transactions")
        .update({ status: "succeeded" })
        .eq("trainer_id", thread.trainer_id)
        .eq("status", "frozen")
        .contains("metadata", { threadId: thread.id });
    }

    return { ok: true };
  });