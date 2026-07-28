import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UnlockedPost = {
  id: string;
  trainer_id: string;
  kind: "feed" | "short";
  caption: string | null;
  media_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  respect_count: number;
  save_count: number;
  view_count: number;
  comment_count: number;
  created_at: string;
  is_premium: boolean;
  source: "purchase" | "subscription";
  unlocked_at: string;
  price: number | null;
  trainer: {
    user_id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
  };
};

/**
 * List every premium post the signed-in user has access to, either through
 * a one-off purchase (post_unlocks) or an active subscription to the creator.
 * Purchases take precedence over subscription attribution when both apply.
 */
export const listMyUnlockedPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UnlockedPost[]> => {
    const { supabase, userId } = context;

    // 1. One-off purchases.
    const { data: unlocks, error: uErr } = await supabase
      .from("post_unlocks")
      .select("post_id, price, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (uErr) throw new Error(uErr.message);
    const unlockMap = new Map<string, { price: number | null; at: string }>();
    for (const r of unlocks ?? []) {
      unlockMap.set(r.post_id, { price: r.price ?? null, at: r.created_at });
    }

    // 2. Active subscriptions -> all premium posts from those creators.
    const { data: subs, error: sErr } = await supabase
      .from("subscriptions")
      .select("trainer_id, current_period_end, status")
      .eq("subscriber_id", userId)
      .in("status", ["active", "trial", "grace"]);
    if (sErr) throw new Error(sErr.message);
    const subTrainerIds = (subs ?? [])
      .filter((s) => new Date(s.current_period_end).getTime() > Date.now())
      .map((s) => s.trainer_id);

    if (unlockMap.size === 0 && subTrainerIds.length === 0) return [];

    // 3. Fetch posts by ID (purchases) OR trainer_id (subscriptions).
    const postIds = Array.from(unlockMap.keys());
    const trainerIds = Array.from(new Set(subTrainerIds));

    const postCols =
      "id, trainer_id, kind, is_premium, caption, media_url, thumbnail_url, duration_seconds, respect_count, save_count, view_count, comment_count, created_at";
    const [byIdRes, byTrainerRes] = await Promise.all([
      postIds.length
        ? supabase
            .from("posts")
            .select(postCols)
            .in("id", postIds)
            .eq("is_hidden", false)
        : Promise.resolve({ data: [], error: null } as const),
      trainerIds.length
        ? supabase
            .from("posts")
            .select(postCols)
            .in("trainer_id", trainerIds)
            .eq("is_premium", true)
            .eq("is_published", true)
            .eq("is_hidden", false)
        : Promise.resolve({ data: [], error: null } as const),
    ]);
    if (byIdRes.error) throw new Error(byIdRes.error.message);
    if (byTrainerRes.error) throw new Error(byTrainerRes.error.message);

    // 4. Merge, dedupe (purchase wins if both).
    const merged = new Map<string, UnlockedPost>();
    for (const p of byTrainerRes.data ?? []) {
      merged.set(p.id, {
        ...(p as any),
        source: "subscription",
        unlocked_at: p.created_at,
        price: null,
        trainer: null as any,
      });
    }
    for (const p of byIdRes.data ?? []) {
      const info = unlockMap.get(p.id);
      merged.set(p.id, {
        ...(p as any),
        source: "purchase",
        unlocked_at: info?.at ?? p.created_at,
        price: info?.price ?? null,
        trainer: null as any,
      });
    }
    const list = Array.from(merged.values());
    if (list.length === 0) return [];

    // 5. Hydrate creator profiles.
    const allTrainerIds = Array.from(new Set(list.map((p) => p.trainer_id)));
    const [profRes, tpRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", allTrainerIds),
      supabase
        .from("trainer_profiles")
        .select("user_id, is_verified")
        .in("user_id", allTrainerIds),
    ]);
    const profMap = new Map((profRes.data ?? []).map((p) => [p.user_id, p]));
    const tpMap = new Map((tpRes.data ?? []).map((t) => [t.user_id, t]));

    // 6. Sign storage URLs (RLS-scoped storage bucket is fine — user owns the unlock).
    const paths = Array.from(
      new Set(
        list
          .flatMap((p) => [p.media_url, p.thumbnail_url])
          .filter((v): v is string => !!v && !v.startsWith("http")),
      ),
    );
    const signed = new Map<string, string>();
    if (paths.length) {
      const { data } = await supabase.storage
        .from("post-media")
        .createSignedUrls(paths, 60 * 60);
      for (const s of data ?? []) {
        if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
      }
    }

    const decorated = list.map((p) => {
      const pr = profMap.get(p.trainer_id);
      const tp = tpMap.get(p.trainer_id);
      return {
        ...p,
        media_url: signed.get(p.media_url) ?? p.media_url,
        thumbnail_url: p.thumbnail_url
          ? signed.get(p.thumbnail_url) ?? p.thumbnail_url
          : null,
        trainer: {
          user_id: p.trainer_id,
          username: pr?.username ?? null,
          display_name: pr?.display_name ?? null,
          avatar_url: pr?.avatar_url ?? null,
          is_verified: !!tp?.is_verified,
        },
      };
    });

    decorated.sort(
      (a, b) =>
        new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime(),
    );
    return decorated;
  });