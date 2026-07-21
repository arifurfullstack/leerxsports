import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CoachingStatus =
  | "draft"
  | "pending"
  | "coached"
  | "follow_up_submitted"
  | "final_response_submitted"
  | "coaching_completed"
  | "cancelled";

export type CoachingMessageKind =
  | "primary_question"
  | "primary_response"
  | "follow_up"
  | "final_response";

export type CoachingThread = {
  id: string;
  subscriber_id: string;
  trainer_id: string;
  title: string;
  description: string;
  category: string | null;
  exercise: string | null;
  goal: string | null;
  injury_info: string | null;
  requested_area: string | null;
  status: CoachingStatus;
  deadline_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  trainer: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
  subscriber: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
};

export type CoachingMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  role: "trainee" | "trainer";
  kind: CoachingMessageKind;
  text: string | null;
  media: string[];
  created_at: string;
};

const SLA_HOURS = 48;

/** List coaching threads for the current user (as trainee OR trainer). */
export const listMyCoachingThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    asTrainee: CoachingThread[];
    asTrainer: CoachingThread[];
  }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("coaching_requests")
      .select("*")
      .or(`subscriber_id.eq.${userId},trainer_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    // hydrate profile names in one query
    const ids = Array.from(new Set(rows.flatMap((r) => [r.trainer_id, r.subscriber_id])));
    let profileMap = new Map<string, { username: string | null; display_name: string | null; avatar_url: string | null }>();
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", ids);
      for (const p of profs ?? []) {
        profileMap.set(p.user_id, {
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
        });
      }
    }
    const withProfiles: CoachingThread[] = rows.map((r) => ({
      ...r,
      trainer: profileMap.get(r.trainer_id) ?? null,
      subscriber: profileMap.get(r.subscriber_id) ?? null,
    }));

    return {
      asTrainee: withProfiles.filter((r) => r.subscriber_id === userId),
      asTrainer: withProfiles.filter((r) => r.trainer_id === userId),
    };
  });

/** Get a thread + its messages. Participants only. */
export const getCoachingThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{
    thread: CoachingThread;
    messages: CoachingMessage[];
    viewerRole: "trainee" | "trainer";
  }> => {
    const { supabase, userId } = context;
    const { data: t, error } = await supabase
      .from("coaching_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!t) throw new Error("Thread not found.");
    if (t.subscriber_id !== userId && t.trainer_id !== userId) {
      throw new Error("You are not a participant of this thread.");
    }

    const [{ data: msgs, error: mErr }, { data: profs }] = await Promise.all([
      supabase
        .from("coaching_messages")
        .select("*")
        .eq("thread_id", data.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", [t.subscriber_id, t.trainer_id]),
    ]);
    if (mErr) throw new Error(mErr.message);

    const profMap = new Map(
      (profs ?? []).map((p) => [p.user_id, {
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
      }]),
    );

    const thread: CoachingThread = {
      ...t,
      trainer: profMap.get(t.trainer_id) ?? null,
      subscriber: profMap.get(t.subscriber_id) ?? null,
    };
    return {
      thread,
      messages: (msgs ?? []) as CoachingMessage[],
      viewerRole: t.subscriber_id === userId ? "trainee" : "trainer",
    };
  });

const createInput = z.object({
  trainerId: z.string().uuid(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(20).max(4000),
  category: z.string().trim().max(60).optional(),
  exercise: z.string().trim().max(80).optional(),
  goal: z.string().trim().max(200).optional(),
  injury_info: z.string().trim().max(1000).optional(),
  requested_area: z.string().trim().max(80).optional(),
});

/** Trainee: open a coaching thread. Consumes the monthly feedback credit. */
export const createCoachingRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (userId === data.trainerId) throw new Error("You can't coach yourself.");

    // Check active subscription
    const { data: gated, error: gErr } = await supabase.rpc("has_active_subscription", {
      _subscriber_id: userId,
      _trainer_id: data.trainerId,
    });
    if (gErr) throw new Error(gErr.message);
    if (!gated) throw new Error("You must be an active subscriber to open a coaching thread.");

    // Find an available feedback credit for this period
    const now = new Date();
    const { data: credit, error: cErr } = await supabase
      .from("feedback_credits")
      .select("id, status, period_end")
      .eq("subscriber_id", userId)
      .eq("trainer_id", data.trainerId)
      .eq("status", "available")
      .gt("period_end", now.toISOString())
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!credit) {
      throw new Error(
        "No coaching credit available this month. Credits reset each period.",
      );
    }

    const deadline = new Date(now.getTime() + SLA_HOURS * 60 * 60 * 1000);

    // Insert thread
    const { data: thread, error: iErr } = await supabase
      .from("coaching_requests")
      .insert({
        subscriber_id: userId,
        trainer_id: data.trainerId,
        credit_id: credit.id,
        title: data.title,
        description: data.description,
        category: data.category ?? null,
        exercise: data.exercise ?? null,
        goal: data.goal ?? null,
        injury_info: data.injury_info ?? null,
        requested_area: data.requested_area ?? null,
        status: "pending",
        deadline_at: deadline.toISOString(),
      })
      .select("id")
      .single();
    if (iErr) throw new Error(iErr.message);

    // Post the primary question message
    const { error: mErr } = await supabase.from("coaching_messages").insert({
      thread_id: thread.id,
      sender_id: userId,
      role: "trainee",
      kind: "primary_question",
      text: data.description,
    });
    if (mErr) throw new Error(mErr.message);

    // Reserve credit → in_use
    await supabase
      .from("feedback_credits")
      .update({ status: "in_use" })
      .eq("id", credit.id);

    return { id: thread.id };
  });

const respondInput = z.object({
  threadId: z.string().uuid(),
  text: z.string().trim().min(1).max(4000),
});

/** Trainer: primary response. Marks thread coached, consumes credit. */
export const submitPrimaryResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => respondInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: t, error } = await supabase
      .from("coaching_requests")
      .select("id, trainer_id, subscriber_id, status, credit_id")
      .eq("id", data.threadId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!t) throw new Error("Thread not found.");
    if (t.trainer_id !== userId) throw new Error("Only the trainer can respond.");
    if (t.status !== "pending") throw new Error("This thread has already been coached.");

    const { error: mErr } = await supabase.from("coaching_messages").insert({
      thread_id: t.id,
      sender_id: userId,
      role: "trainer",
      kind: "primary_response",
      text: data.text,
    });
    if (mErr) throw new Error(mErr.message);

    await supabase
      .from("coaching_requests")
      .update({ status: "coached" })
      .eq("id", t.id);

    if (t.credit_id) {
      await supabase
        .from("feedback_credits")
        .update({ status: "consumed" })
        .eq("id", t.credit_id);
    }
    return { ok: true };
  });

/** Trainee: single follow-up. Only after primary response. */
export const submitFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => respondInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: t, error } = await supabase
      .from("coaching_requests")
      .select("id, subscriber_id, trainer_id, status")
      .eq("id", data.threadId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!t) throw new Error("Thread not found.");
    if (t.subscriber_id !== userId) throw new Error("Only the trainee can follow up.");
    if (t.status !== "coached") {
      throw new Error("Follow-up is only allowed after the trainer's response.");
    }

    const { error: mErr } = await supabase.from("coaching_messages").insert({
      thread_id: t.id,
      sender_id: userId,
      role: "trainee",
      kind: "follow_up",
      text: data.text,
    });
    if (mErr) throw new Error(mErr.message);

    await supabase
      .from("coaching_requests")
      .update({ status: "follow_up_submitted" })
      .eq("id", t.id);
    return { ok: true };
  });

/** Trainer: single final response. Completes the thread. */
export const submitFinalResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => respondInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: t, error } = await supabase
      .from("coaching_requests")
      .select("id, trainer_id, status")
      .eq("id", data.threadId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!t) throw new Error("Thread not found.");
    if (t.trainer_id !== userId) throw new Error("Only the trainer can post a final response.");
    if (t.status !== "follow_up_submitted") {
      throw new Error("A final response can only be posted after the trainee's follow-up.");
    }

    const { error: mErr } = await supabase.from("coaching_messages").insert({
      thread_id: t.id,
      sender_id: userId,
      role: "trainer",
      kind: "final_response",
      text: data.text,
    });
    if (mErr) throw new Error(mErr.message);

    const now = new Date().toISOString();
    await supabase
      .from("coaching_requests")
      .update({
        status: "coaching_completed",
        completed_at: now,
      })
      .eq("id", t.id);
    return { ok: true };
  });
