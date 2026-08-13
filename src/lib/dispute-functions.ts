import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const openDisputeSchema = z.object({
  threadId: z.string().uuid(),
  reason: z.enum([
    "unresponsive_trainer",
    "incomplete_coaching",
    "inappropriate_behavior",
    "quality_dispute",
    "other",
  ]),
  details: z.string().min(5).max(2000),
});

export type DisputeReason = z.infer<typeof openDisputeSchema>["reason"];

export const openCoachingDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => openDisputeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch thread (check in community_posts first)
    const { data: post, error: postErr } = await supabase
      .from("community_posts")
      .select("id, author_id, target_trainer_id, coaching_status")
      .eq("id", data.threadId)
      .maybeSingle();

    if (postErr) throw new Error(postErr.message);

    if (post) {
      if (post.author_id !== userId && post.target_trainer_id !== userId) {
        throw new Error("Only thread participants can open a coaching dispute.");
      }
      // Set status to disputing
      await supabaseAdmin
        .from("community_posts")
        .update({ coaching_status: "disputing" })
        .eq("id", data.threadId);
    }

    // 2. Insert into reports queue for admin review
    const { error: reportErr } = await supabaseAdmin.from("reports").insert({
      reporter_id: userId,
      target_type: "coaching_thread",
      target_id: data.threadId,
      reason: data.reason === "inappropriate_behavior" ? "abuse" : "other",
      details: `[COACHING DISPUTE] ${data.reason.toUpperCase()}: ${data.details}`,
      status: "open",
    });

    if (reportErr && reportErr.code !== "23505") {
      console.error("Dispute report queue error:", reportErr);
    }

    return { ok: true, status: "disputing" };
  });

export const resolveCoachingDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        threadId: z.string().uuid(),
        verdict: z.enum(["trainer_upheld", "user_upheld"]),
        note: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Admin role check
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: Admin access required.");

    // Fetch thread info
    const { data: post } = await supabaseAdmin
      .from("community_posts")
      .select("id, author_id, target_trainer_id")
      .eq("id", data.threadId)
      .maybeSingle();

    const finalStatus = data.verdict === "trainer_upheld" ? "coaching_completed" : "dispute_refunded";

    if (post) {
      await supabaseAdmin
        .from("community_posts")
        .update({ coaching_status: finalStatus })
        .eq("id", data.threadId);
    }

    // If user upheld, issue strike against trainer
    if (data.verdict === "user_upheld" && post?.target_trainer_id) {
      await supabaseAdmin.from("trainer_strikes").insert({
        trainer_id: post.target_trainer_id,
        reason: `Dispute Lost: ${data.note || "Unsatisfactory coaching delivery"}`,
        issued_by: context.userId,
        status: "active",
      });
    }

    // Resolve reports associated with thread
    await supabaseAdmin
      .from("reports")
      .update({
        status: "actioned",
        resolution_note: `Verdict: ${data.verdict}. ${data.note ?? ""}`,
        resolved_by: context.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("target_type", "coaching_thread")
      .eq("target_id", data.threadId);

    // Audit log
    await supabaseAdmin.from("moderation_actions").insert({
      actor_id: context.userId,
      target_type: "coaching_thread",
      target_id: data.threadId,
      action: data.verdict === "trainer_upheld" ? "restore" : "remove",
      reason: `Dispute Verdict: ${data.verdict}. ${data.note ?? ""}`,
    });

    return { ok: true, finalStatus };
  });
