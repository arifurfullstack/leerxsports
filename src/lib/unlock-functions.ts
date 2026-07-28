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
 * Legacy endpoint retained so older clients fail safely instead of receiving
 * premium access without a verified payment.
 */
export const unlockPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    throw new Error("Use the verified checkout flow to unlock this post.");
  });
