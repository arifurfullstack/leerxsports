import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SubscriptionInfo = {
  isSubscribed: boolean;
  isFollowing: boolean;
  subscription: {
    id: string;
    status: string;
    current_period_end: string;
    price: number;
  } | null;
  credit: {
    id: string;
    status: string;
    period_end: string;
  } | null;
};

/**
 * Return the signed-in user's subscription + follow state for a given trainer,
 * plus the current-period feedback credit if any.
 */
export const getSubscriptionInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ trainerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<SubscriptionInfo> => {
    const { supabase, userId } = context;

    const [subRes, followRes] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("id, status, current_period_end, price")
        .eq("subscriber_id", userId)
        .eq("trainer_id", data.trainerId)
        .maybeSingle(),
      supabase
        .from("follows")
        .select("id")
        .eq("follower_id", userId)
        .eq("trainer_id", data.trainerId)
        .maybeSingle(),
    ]);
    if (subRes.error) throw new Error(subRes.error.message);
    if (followRes.error) throw new Error(followRes.error.message);

    const sub = subRes.data;
    const isActive =
      !!sub &&
      ["active", "trial", "grace"].includes(sub.status) &&
      new Date(sub.current_period_end).getTime() > Date.now();

    let credit: SubscriptionInfo["credit"] = null;
    if (sub) {
      const { data: c, error: cErr } = await supabase
        .from("feedback_credits")
        .select("id, status, period_end")
        .eq("subscription_id", sub.id)
        .order("period_end", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cErr) throw new Error(cErr.message);
      credit = c
        ? { id: c.id, status: c.status, period_end: c.period_end }
        : null;
    }

    return {
      isSubscribed: isActive,
      isFollowing: !!followRes.data,
      subscription: sub
        ? {
            id: sub.id,
            status: sub.status,
            current_period_end: sub.current_period_end,
            price: Number(sub.price ?? 0),
          }
        : null,
      credit,
    };
  });

/**
 * Legacy endpoint retained so older clients fail safely instead of receiving
 * free access. New clients must use createCheckoutOrder().
 */
export const subscribeToTrainer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    throw new Error("Use the verified checkout flow to subscribe.");
  });

export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ trainerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("subscriber_id", userId)
      .eq("trainer_id", data.trainerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sub) throw new Error("No subscription to cancel.");

    const { error: upErr } = await supabase
      .from("subscriptions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", sub.id);
    if (upErr) throw new Error(upErr.message);

    await supabase.from("subscription_events").insert({
      subscription_id: sub.id,
      kind: "cancelled",
      metadata: { source: "self" },
    });
    return { ok: true };
  });

export const toggleFollow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    const schema = z
      .object({
        trainerId: z.string().uuid().optional(),
        trainerUserId: z.string().uuid().optional(),
      })
      .refine((d) => Boolean(d.trainerId || d.trainerUserId), {
        message: "trainerId is required",
      })
      .transform((d) => ({
        trainerId: (d.trainerId || d.trainerUserId)!,
      }));
    return schema.parse(input);
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (userId === data.trainerId) throw new Error("You can't follow yourself.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("follows")
      .select("id")
      .eq("follower_id", userId)
      .eq("trainer_id", data.trainerId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin.from("follows").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { following: false };
    }

    const { error } = await supabaseAdmin
      .from("follows")
      .insert({ follower_id: userId, trainer_id: data.trainerId });
    if (error) throw new Error(error.message);

    return { following: true };
  });

/**
 * Return the set of trainer/user IDs the current signed-in user follows.
 * Used by the feed to render follow state and filter to "Following only".
 */
export const getFollowingIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("follows")
      .select("trainer_id")
      .eq("follower_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.trainer_id);
  });

/**
 * Lightweight follow-state lookup for any target user (trainer or athlete).
 * Returns { isFollowing: false } when the caller is unauthenticated so it
 * can be called from public routes without gating.
 */
export const getFollowState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ isFollowing: boolean }> => {
    const { supabase, userId } = context;
    if (userId === data.userId) return { isFollowing: false };
    const { data: row, error } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", userId)
      .eq("trainer_id", data.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { isFollowing: !!row };
  });

/**
 * Return signed URLs for the premium posts of a trainer, but only if the
 * caller has an active subscription. This is how the client "unlocks" the
 * blurred tiles on the trainer profile after subscribing.
 */
export const getPremiumPostUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ trainerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<Record<string, { media_url: string; thumbnail_url: string | null }>> => {
    const { supabase, userId } = context;

    const { data: gated, error: gErr } = await supabase.rpc("has_active_subscription", {
      _subscriber_id: userId,
      _trainer_id: data.trainerId,
    });
    if (gErr) throw new Error(gErr.message);

    // Owner sees everything; subscriber sees everything; otherwise only
    // posts they've purchased a one-off unlock for.
    const { data: ownerRow } = await supabase
      .from("trainer_profiles")
      .select("user_id")
      .eq("user_id", data.trainerId)
      .maybeSingle();
    const isOwner = ownerRow?.user_id === userId;

    const { data: allRows, error } = await supabase
      .from("posts")
      .select("id, media_url, thumbnail_url")
      .eq("trainer_id", data.trainerId)
      .eq("is_premium", true)
      .eq("is_published", true)
      .eq("is_hidden", false);
    if (error) throw new Error(error.message);

    let rows = allRows ?? [];
    if (!gated && !isOwner) {
      const ids = rows.map((r) => r.id);
      if (!ids.length) return {};
      const { data: unlocks } = await supabase
        .from("post_unlocks")
        .select("post_id")
        .eq("user_id", userId)
        .in("post_id", ids);
      const unlocked = new Set((unlocks ?? []).map((u) => u.post_id));
      rows = rows.filter((r) => unlocked.has(r.id));
      if (!rows.length) return {};
    }

    const paths = (rows ?? [])
      .flatMap((r) => [r.media_url, r.thumbnail_url])
      .filter((p): p is string => !!p && !p.startsWith("http"));
    const signedMap = new Map<string, string>();
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage
        .from("post-media")
        .createSignedUrls(Array.from(new Set(paths)), 60 * 60);
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) signedMap.set(s.path, s.signedUrl);
      }
    }

    const result: Record<string, { media_url: string; thumbnail_url: string | null }> = {};
    for (const r of rows ?? []) {
      result[r.id] = {
        media_url: signedMap.get(r.media_url) ?? r.media_url,
        thumbnail_url: r.thumbnail_url
          ? signedMap.get(r.thumbnail_url) ?? r.thumbnail_url
          : null,
      };
    }
    return result;
  });