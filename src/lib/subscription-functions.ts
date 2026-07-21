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
  .inputValidator((input) => z.object({ trainerId: z.string().uuid() }).parse(input))
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
 * Placeholder subscribe flow. Creates or reactivates a 30-day active
 * subscription with a fresh feedback credit. Stripe wiring lands in Phase 9.
 */
export const subscribeToTrainer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ trainerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (userId === data.trainerId) {
      throw new Error("You can't subscribe to yourself.");
    }

    // Confirm trainer has monetization enabled + fetch price
    const { data: tp, error: tpErr } = await supabase
      .from("trainer_profiles")
      .select("user_id, subscription_price, monetization_enabled")
      .eq("user_id", data.trainerId)
      .maybeSingle();
    if (tpErr) throw new Error(tpErr.message);
    if (!tp) throw new Error("Trainer not found.");
    if (!tp.monetization_enabled) {
      throw new Error("This trainer isn't accepting subscriptions yet.");
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Upsert subscription (subscriber_id, trainer_id unique)
    const { data: existing, error: exErr } = await supabase
      .from("subscriptions")
      .select("id, status")
      .eq("subscriber_id", userId)
      .eq("trainer_id", data.trainerId)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);

    let subId: string;
    let eventKind: "created" | "reactivated" | "renewed";
    if (existing) {
      const { error: upErr } = await supabase
        .from("subscriptions")
        .update({
          status: "active",
          price: tp.subscription_price ?? 0,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          cancelled_at: null,
        })
        .eq("id", existing.id);
      if (upErr) throw new Error(upErr.message);
      subId = existing.id;
      eventKind = existing.status === "cancelled" ? "reactivated" : "renewed";
    } else {
      const { data: ins, error: insErr } = await supabase
        .from("subscriptions")
        .insert({
          subscriber_id: userId,
          trainer_id: data.trainerId,
          status: "active",
          price: tp.subscription_price ?? 0,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      subId = ins.id;
      eventKind = "created";
    }

    // Audit event
    await supabase.from("subscription_events").insert({
      subscription_id: subId,
      kind: eventKind,
      metadata: { source: "placeholder" },
    });

    // Record transaction + bump trainer balance (server-side only)
    const price = Number(tp.subscription_price ?? 0);
    if (price > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: settings } = await supabaseAdmin
        .from("platform_settings")
        .select("commission_bps, base_currency")
        .eq("id", true)
        .maybeSingle();
      const bps = settings?.commission_bps ?? 2000;
      const currency = settings?.base_currency ?? "USD";
      const platformFee = Math.round(price * bps) / 10000;
      const trainerAmount = Math.round((price - platformFee) * 100) / 100;
      await supabaseAdmin.from("transactions").insert({
        kind: "subscription",
        status: "succeeded",
        payer_id: userId,
        trainer_id: data.trainerId,
        subscription_id: subId,
        gross: price,
        platform_fee: platformFee,
        trainer_amount: trainerAmount,
        currency,
        metadata: { source: "placeholder", event: eventKind },
      });
      const { data: bal } = await supabaseAdmin
        .from("trainer_balances")
        .select("trainer_id, pending_amount")
        .eq("trainer_id", data.trainerId)
        .maybeSingle();
      if (bal) {
        await supabaseAdmin
          .from("trainer_balances")
          .update({
            pending_amount: Number(bal.pending_amount ?? 0) + trainerAmount,
          })
          .eq("trainer_id", data.trainerId);
      } else {
        await supabaseAdmin.from("trainer_balances").insert({
          trainer_id: data.trainerId,
          pending_amount: trainerAmount,
          currency,
        });
      }
    }

    // Issue a fresh feedback credit for the new period (no rollover)
    const { data: openCredit } = await supabase
      .from("feedback_credits")
      .select("id")
      .eq("subscription_id", subId)
      .gt("period_end", now.toISOString())
      .maybeSingle();
    if (!openCredit) {
      await supabase.from("feedback_credits").insert({
        subscription_id: subId,
        subscriber_id: userId,
        trainer_id: data.trainerId,
        period_start: now.toISOString(),
        period_end: periodEnd.toISOString(),
        status: "available",
      });
    }

    return { ok: true, subscriptionId: subId };
  });

export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ trainerId: z.string().uuid() }).parse(input))
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
  .inputValidator((input) => z.object({ trainerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (userId === data.trainerId) throw new Error("You can't follow yourself.");
    const { data: existing } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", userId)
      .eq("trainer_id", data.trainerId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase.from("follows").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { following: false };
    }
    const { error } = await supabase
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
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
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
  .inputValidator((input) => z.object({ trainerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<Record<string, { media_url: string; thumbnail_url: string | null }>> => {
    const { supabase, userId } = context;

    const { data: gated, error: gErr } = await supabase.rpc("has_active_subscription", {
      _subscriber_id: userId,
      _trainer_id: data.trainerId,
    });
    if (gErr) throw new Error(gErr.message);
    if (!gated) return {};

    const { data: rows, error } = await supabase
      .from("posts")
      .select("id, media_url, thumbnail_url")
      .eq("trainer_id", data.trainerId)
      .eq("is_premium", true)
      .eq("is_published", true).eq("is_hidden", false);
    if (error) throw new Error(error.message);

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