import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UnlockInfo = {
  price: number;
  currency: string;
  unlocked: boolean;
  via: "owner" | "subscription" | "purchase" | null;
  media_url: string | null;
  thumbnail_url: string | null;
};

type SupabaseLike = {
  storage: {
    from: (b: string) => {
      createSignedUrls: (
        paths: string[],
        expiresIn: number,
      ) => Promise<{ data: Array<{ path: string | null; signedUrl: string | null }> | null }>;
    };
  };
};

async function signPaths(supabase: SupabaseLike, paths: (string | null | undefined)[]) {
  const clean = Array.from(
    new Set(
      paths.filter((p): p is string => !!p && !p.startsWith("http")),
    ),
  );
  const m = new Map<string, string>();
  if (!clean.length) return m;
  const { data } = await supabase.storage
    .from("post-media")
    .createSignedUrls(clean, 60 * 60);
  for (const s of data ?? []) if (s.path && s.signedUrl) m.set(s.path, s.signedUrl);
  return m;
}

/**
 * Return pricing + whether the caller can view the media of a premium post.
 * A caller "owns" access if they are the creator, hold an active subscription,
 * or have previously purchased a one-off unlock for this post.
 */
export const getPostUnlockInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z.object({ postId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<UnlockInfo> => {
    const { supabase, userId } = context;
    const { data: post, error } = await supabase
      .from("posts")
      .select("id, trainer_id, is_premium, media_url, thumbnail_url, unlock_price")
      .eq("id", data.postId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!post) throw new Error("Post not found");

    const { data: tp } = await supabase
      .from("trainer_profiles")
      .select("subscription_price")
      .eq("user_id", post.trainer_id)
      .maybeSingle();
    const price = Number(post.unlock_price ?? tp?.subscription_price ?? 0);
    const currency = "USD";

    if (!post.is_premium) {
      const map = await signPaths(supabase, [post.media_url, post.thumbnail_url]);
      return {
        price,
        currency,
        unlocked: true,
        via: null,
        media_url: post.media_url ? map.get(post.media_url) ?? post.media_url : null,
        thumbnail_url: post.thumbnail_url
          ? map.get(post.thumbnail_url) ?? post.thumbnail_url
          : null,
      };
    }

    let via: UnlockInfo["via"] = null;
    if (post.trainer_id === userId) via = "owner";
    if (!via) {
      const { data: sub } = await supabase.rpc("has_active_subscription", {
        _subscriber_id: userId,
        _trainer_id: post.trainer_id,
      });
      if (sub) via = "subscription";
    }
    if (!via) {
      const { data: unl } = await supabase
        .from("post_unlocks")
        .select("id")
        .eq("post_id", data.postId)
        .eq("user_id", userId)
        .maybeSingle();
      if (unl) via = "purchase";
    }

    if (!via) {
      return { price, currency, unlocked: false, via: null, media_url: null, thumbnail_url: null };
    }

    const map = await signPaths(supabase, [post.media_url, post.thumbnail_url]);
    return {
      price,
      currency,
      unlocked: true,
      via,
      media_url: post.media_url ? map.get(post.media_url) ?? post.media_url : null,
      thumbnail_url: post.thumbnail_url
        ? map.get(post.thumbnail_url) ?? post.thumbnail_url
        : null,
    };
  });

/**
 * Purchase a one-off unlock for a premium post. This is currently a
 * placeholder charge (no real card flow) that records a transaction,
 * creates the `post_unlocks` row, and credits the creator's balance.
 * Swap this for a real Stripe/Paddle checkout session once a provider is
 * enabled — the rest of the flow (server-side gate + signed URL delivery)
 * does not need to change.
 */
export const unlockPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        postId: z.string().uuid(),
        paymentIntentId: z.string().optional(),
        provider: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: post, error } = await supabase
      .from("posts")
      .select("id, trainer_id, is_premium, unlock_price")
      .eq("id", data.postId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!post) throw new Error("Post not found");
    if (!post.is_premium) throw new Error("This post isn't premium.");
    if (post.trainer_id === userId) throw new Error("You already own this post.");

    const { data: existing } = await supabase
      .from("post_unlocks")
      .select("id")
      .eq("post_id", data.postId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return { ok: true, alreadyUnlocked: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: settings }, { data: tp }] = await Promise.all([
      supabaseAdmin
        .from("platform_settings")
        .select("commission_bps, base_currency")
        .eq("id", true)
        .maybeSingle(),
      supabaseAdmin
        .from("trainer_profiles")
        .select("subscription_price")
        .eq("user_id", post.trainer_id)
        .maybeSingle(),
    ]);

    const bps = settings?.commission_bps ?? 2000;
    const currency = settings?.base_currency ?? "USD";
    const gross = Number(post.unlock_price ?? tp?.subscription_price ?? 0);
    if (!(gross > 0)) throw new Error("This post has no unlock price configured.");
    const platformFee = Math.round(gross * bps) / 10000;
    const trainerAmount = Math.round((gross - platformFee) * 100) / 100;

    const { data: tx, error: txErr } = await supabaseAdmin
      .from("transactions")
      .insert({
        kind: "unlock",
        status: "succeeded",
        payer_id: userId,
        trainer_id: post.trainer_id,
        gross,
        platform_fee: platformFee,
        trainer_amount: trainerAmount,
        currency,
        stripe_payment_intent_id: data.paymentIntentId ?? null,
        metadata: {
          source: data.paymentIntentId ? (data.provider ?? "stripe") : "placeholder",
          post_id: post.id,
          payment_intent_id: data.paymentIntentId ?? null,
        },
      })
      .select("id")
      .single();
    if (txErr) throw new Error(txErr.message);

    const { error: unlErr } = await supabaseAdmin.from("post_unlocks").insert({
      post_id: data.postId,
      user_id: userId,
      trainer_id: post.trainer_id,
      price: gross,
      currency,
      transaction_id: tx.id,
      provider: data.paymentIntentId ? (data.provider ?? "stripe") : "placeholder",
    });
    if (unlErr) throw new Error(unlErr.message);

    const { data: bal } = await supabaseAdmin
      .from("trainer_balances")
      .select("available_amount")
      .eq("trainer_id", post.trainer_id)
      .maybeSingle();
    if (bal) {
      await supabaseAdmin
        .from("trainer_balances")
        .update({
          available_amount: Number(bal.available_amount ?? 0) + trainerAmount,
        })
        .eq("trainer_id", post.trainer_id);
    } else {
      await supabaseAdmin.from("trainer_balances").insert({
        trainer_id: post.trainer_id,
        available_amount: trainerAmount,
        currency,
      });
    }

    return { ok: true, alreadyUnlocked: false };
  });