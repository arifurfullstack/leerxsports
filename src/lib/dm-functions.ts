import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DmThreadSummary = {
  id: string;
  other_user_id: string;
  other_username: string | null;
  other_display_name: string | null;
  other_avatar_url: string | null;
  last_message_at: string | null;
  last_text: string | null;
  unread_count: number;
};

export type DmMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  text: string | null;
  media: string[];
  read_at: string | null;
  created_at: string;
};

function canonPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

async function assertCanDm(context: { supabase: any; userId: string }, otherUserId: string) {
  if (context.userId === otherUserId) throw new Error("Cannot DM yourself.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Blocks (either direction)
  const { data: blocked } = await supabaseAdmin
    .from("blocks")
    .select("blocker_id")
    .or(`and(blocker_id.eq.${context.userId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${context.userId})`)
    .limit(1);
  if (blocked && blocked.length > 0) throw new Error("You cannot message this user.");

  // Determine roles: at least one participant must be a trainer, and the trainee side must have an active subscription
  const { data: myTrainer } = await supabaseAdmin
    .from("trainer_profiles")
    .select("user_id, dms_enabled")
    .eq("user_id", context.userId)
    .maybeSingle();
  const { data: otherTrainer } = await supabaseAdmin
    .from("trainer_profiles")
    .select("user_id, dms_enabled")
    .eq("user_id", otherUserId)
    .maybeSingle();

  if (!myTrainer && !otherTrainer) {
    throw new Error("Direct messages are only available between trainers and their subscribers.");
  }

  // If I am the trainee (other is the trainer): I must have an active sub AND their DMs must be enabled.
  if (!myTrainer && otherTrainer) {
    if (otherTrainer.dms_enabled === false) throw new Error("This trainer has disabled direct messages.");
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id, status, current_period_end")
      .eq("subscriber_id", context.userId)
      .eq("trainer_id", otherUserId)
      .in("status", ["active", "trial", "grace"])
      .gt("current_period_end", new Date().toISOString())
      .maybeSingle();
    if (!sub) throw new Error("Subscribe to this trainer to send them a direct message.");
  }

  // If I am the trainer (other is a trainee): the trainee must have an active sub to me.
  if (myTrainer && !otherTrainer) {
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("subscriber_id", otherUserId)
      .eq("trainer_id", context.userId)
      .in("status", ["active", "trial", "grace"])
      .gt("current_period_end", new Date().toISOString())
      .maybeSingle();
    if (!sub) throw new Error("You can only DM active subscribers.");
  }
  // Both trainers: allowed.
}

async function getOrCreateThread(context: { userId: string }, otherUserId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [a, b] = canonPair(context.userId, otherUserId);
  const { data: existing } = await supabaseAdmin
    .from("dm_threads")
    .select("id")
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await supabaseAdmin
    .from("dm_threads")
    .insert({ user_a: a, user_b: b })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id;
}

export const openDmThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertCanDm(context, data.userId);
    const id = await getOrCreateThread(context, data.userId);
    return { threadId: id };
  });

export const listDmThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: threads, error } = await supabaseAdmin
      .from("dm_threads")
      .select("id, user_a, user_b, last_message_at")
      .or(`user_a.eq.${context.userId},user_b.eq.${context.userId}`)
      .order("last_message_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);

    const ids = (threads ?? []).map((t: any) => t.id);
    const otherIds = (threads ?? []).map((t: any) => (t.user_a === context.userId ? t.user_b : t.user_a));

    let profiles: Record<string, any> = {};
    if (otherIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", otherIds);
      for (const p of profs ?? []) profiles[p.user_id] = p;
    }

    let lastMap: Record<string, { text: string | null; created_at: string }> = {};
    let unreadMap: Record<string, number> = {};
    if (ids.length) {
      const { data: lastMsgs } = await supabaseAdmin
        .from("direct_messages")
        .select("thread_id, text, created_at")
        .in("thread_id", ids)
        .order("created_at", { ascending: false });
      for (const m of lastMsgs ?? []) {
        if (!lastMap[m.thread_id]) lastMap[m.thread_id] = { text: m.text, created_at: m.created_at };
      }
      const { data: unread } = await supabaseAdmin
        .from("direct_messages")
        .select("thread_id, sender_id, read_at")
        .in("thread_id", ids)
        .is("read_at", null);
      for (const u of unread ?? []) {
        if (u.sender_id !== context.userId) {
          unreadMap[u.thread_id] = (unreadMap[u.thread_id] ?? 0) + 1;
        }
      }
    }

    return (threads ?? []).map((t: any) => {
      const otherId = t.user_a === context.userId ? t.user_b : t.user_a;
      const p = profiles[otherId] ?? {};
      return {
        id: t.id,
        other_user_id: otherId,
        other_username: p.username ?? null,
        other_display_name: p.display_name ?? null,
        other_avatar_url: p.avatar_url ?? null,
        last_message_at: t.last_message_at,
        last_text: lastMap[t.id]?.text ?? null,
        unread_count: unreadMap[t.id] ?? 0,
      } as DmThreadSummary;
    });
  });

export const listDmMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ threadId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: thread, error: tErr } = await context.supabase
      .from("dm_threads")
      .select("id, user_a, user_b")
      .eq("id", data.threadId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!thread) throw new Error("Thread not found.");
    if (thread.user_a !== context.userId && thread.user_b !== context.userId) {
      throw new Error("Forbidden.");
    }
    const { data: msgs, error } = await context.supabase
      .from("direct_messages")
      .select("id, thread_id, sender_id, text, media, read_at, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);

    // Mark unread messages from the other user as read
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("direct_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("thread_id", data.threadId)
      .neq("sender_id", context.userId)
      .is("read_at", null);

    return (msgs ?? []) as DmMessage[];
  });

export const sendDmMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        threadId: z.string().uuid().optional(),
        toUserId: z.string().uuid().optional(),
        text: z.string().max(4000).optional(),
        media: z.array(z.string().max(500)).max(4).default([]),
      })
      .refine((v) => !!v.threadId || !!v.toUserId, "threadId or toUserId required")
      .refine((v) => (v.text?.trim().length ?? 0) > 0 || (v.media?.length ?? 0) > 0, "empty message")
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let threadId = data.threadId;
    let otherUserId = data.toUserId;

    if (threadId) {
      const { data: t } = await supabaseAdmin
        .from("dm_threads")
        .select("user_a, user_b")
        .eq("id", threadId)
        .maybeSingle();
      if (!t) throw new Error("Thread not found.");
      if (t.user_a !== context.userId && t.user_b !== context.userId) throw new Error("Forbidden.");
      otherUserId = t.user_a === context.userId ? t.user_b : t.user_a;
    }
    if (!otherUserId) throw new Error("Recipient required.");
    await assertCanDm(context, otherUserId);
    if (!threadId) threadId = await getOrCreateThread(context, otherUserId);

    const nowIso = new Date().toISOString();
    const { data: msg, error } = await supabaseAdmin
      .from("direct_messages")
      .insert({
        thread_id: threadId,
        sender_id: context.userId,
        text: data.text ?? null,
        media: data.media ?? [],
      })
      .select("id, thread_id, sender_id, text, media, read_at, created_at")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("dm_threads")
      .update({ last_message_at: nowIso })
      .eq("id", threadId);

    return msg as DmMessage;
  });

export const listBlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("blocks")
      .select("blocked_id, created_at, profile:profiles!blocks_blocked_id_fkey(user_id, username, display_name, avatar_url)")
      .eq("blocker_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      blocked_id: r.blocked_id,
      created_at: r.created_at,
      username: r.profile?.username ?? null,
      display_name: r.profile?.display_name ?? null,
      avatar_url: r.profile?.avatar_url ?? null,
    }));
  });

export const blockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("Cannot block yourself.");
    const { error } = await context.supabase
      .from("blocks")
      .insert({ blocker_id: context.userId, blocked_id: data.userId });
    if (error && !`${error.message}`.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const unblockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("blocks")
      .delete()
      .eq("blocker_id", context.userId)
      .eq("blocked_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setDmsEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("trainer_profiles")
      .update({ dms_enabled: data.enabled })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type MessageableTrainer = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * Trainers the signed-in user can DM right now:
 * - active subscription (active/trial/grace, not expired)
 * - trainer has dms_enabled = true
 * - not blocked either direction
 */
export const listMessageableTrainers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();

    const { data: subs, error } = await supabaseAdmin
      .from("subscriptions")
      .select("trainer_id, status, current_period_end")
      .eq("subscriber_id", context.userId)
      .in("status", ["active", "trial", "grace"])
      .gt("current_period_end", nowIso);
    if (error) throw new Error(error.message);

    const trainerIds = Array.from(new Set((subs ?? []).map((s: any) => s.trainer_id)));
    if (trainerIds.length === 0) return [] as MessageableTrainer[];

    const { data: tps } = await supabaseAdmin
      .from("trainer_profiles")
      .select("user_id, dms_enabled")
      .in("user_id", trainerIds)
      .eq("dms_enabled", true);
    const eligible = (tps ?? []).map((t: any) => t.user_id);
    if (eligible.length === 0) return [] as MessageableTrainer[];

    const { data: blocks } = await supabaseAdmin
      .from("blocks")
      .select("blocker_id, blocked_id")
      .or(
        `and(blocker_id.eq.${context.userId},blocked_id.in.(${eligible.join(",")})),and(blocked_id.eq.${context.userId},blocker_id.in.(${eligible.join(",")}))`,
      );
    const blockedSet = new Set<string>();
    for (const b of blocks ?? []) {
      blockedSet.add(b.blocker_id === context.userId ? b.blocked_id : b.blocker_id);
    }

    const finalIds = eligible.filter((id: string) => !blockedSet.has(id));
    if (finalIds.length === 0) return [] as MessageableTrainer[];

    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .in("user_id", finalIds);

    return (profs ?? [])
      .map((p: any) => ({
        user_id: p.user_id,
        username: p.username ?? null,
        display_name: p.display_name ?? null,
        avatar_url: p.avatar_url ?? null,
      }))
      .sort((a: MessageableTrainer, b: MessageableTrainer) =>
        (a.display_name ?? a.username ?? "").localeCompare(b.display_name ?? b.username ?? ""),
      ) as MessageableTrainer[];
  });