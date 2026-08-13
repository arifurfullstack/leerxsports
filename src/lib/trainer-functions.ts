import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { optionalSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-bearer";

function getPublicSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase URL and Key must be provided in environment variables.");
  }
  return createClient<Database>(url, key, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export type TrainerSummary = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  country: string | null;
  bio: string | null;
  specialties: string[];
  subscription_price: number;
  is_verified: boolean;
};

export type Post = {
  id: string;
  trainer_id: string;
  kind: "feed" | "short";
  is_premium: boolean;
  caption: string | null;
  media_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  respect_count: number;
  save_count: number;
  view_count: number;
  comment_count: number;
  created_at: string;
};

export function resolveDiscoveryCount(
  counts: ReadonlyMap<string, number>,
  postId: string,
  storedCount: number,
  _queryError: unknown,
): number {
  // Anonymous RLS reads may resolve to an empty result without surfacing an
  // error. Only replace the denormalized counter when the recount actually
  // contains this post.
  return counts.has(postId) ? counts.get(postId)! : storedCount;
}

export type TrainerDetail = TrainerSummary & {
  value_proposition: string;
  monetization_enabled: boolean;
  dms_enabled: boolean;
  posts: Post[];
  community_posts: TrainerCommunityPost[];
};

export type TrainerCommunityPost = {
  id: string;
  kind: "question" | "flex";
  title: string;
  body: string | null;
  hashtags: string[];
  respect_count: number;
  comment_count: number;
  trainer_answered: boolean;
  coaching_status: "pending" | "coached" | "coaching_completed" | null;
  created_at: string;
  author_id: string;
  target_trainer_id: string | null;
};

export type DiscoveryPost = Post & {
  trainer: {
    user_id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
  };
};

async function decoratePosts<
  T extends { media_url: string; thumbnail_url: string | null }
>(
  supabase: ReturnType<typeof getPublicSupabase>,
  posts: T[],
  currentUserId?: string | null,
  subscribedTrainerIds?: Set<string>,
  unlockedPostIds?: Set<string>,
): Promise<T[]> {
  const canAccess = (p: T) => {
    const item = p as unknown as { id?: string; trainer_id?: string; is_premium?: boolean };
    if (!item.is_premium) return true;
    if (currentUserId && item.trainer_id && currentUserId === item.trainer_id) return true;
    if (subscribedTrainerIds && item.trainer_id && subscribedTrainerIds.has(item.trainer_id)) return true;
    if (unlockedPostIds && item.id && unlockedPostIds.has(item.id)) return true;
    return false;
  };

  const paths = posts
    .flatMap((p) => [
      canAccess(p) ? p.media_url : null,
      canAccess(p) ? p.thumbnail_url : null,
    ])
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

  return posts.map((p): T => {
    const hasAccess = canAccess(p);
    const item = p as unknown as { is_premium?: boolean };
    if (item.is_premium && !hasAccess) {
      return { ...p, media_url: "", thumbnail_url: null };
    }
    return {
      ...p,
      media_url: signedMap.get(p.media_url) ?? p.media_url,
      thumbnail_url: p.thumbnail_url
        ? signedMap.get(p.thumbnail_url) ?? p.thumbnail_url
        : null,
    };
  });
}

function scorePost(p: {
  respect_count: number;
  save_count: number;
  view_count: number;
  created_at: string;
}) {
  const ageHours = Math.max(
    1,
    (Date.now() - new Date(p.created_at).getTime()) / 36e5,
  );
  // freshness half-life ~48h; respect weighted highest
  const engagement =
    p.respect_count * 3 + p.save_count * 2 + p.view_count * 0.1;
  const freshness = 1 / Math.pow(ageHours / 48 + 1, 1.2);
  return engagement * 0.4 + freshness * 100;
}

export type ExploreFilters = {
  kind?: "feed" | "short" | "all";
  country?: string | null;
  specialty?: string | null;
  verifiedOnly?: boolean;
  sort?: "top" | "recent" | "random";
  excludeDemo?: boolean;
};

async function fetchDiscovery(
  kind: "feed" | "short" | "all",
  filters: ExploreFilters = {},
  contextUserId?: string | null,
  contextSupabase?: ReturnType<typeof getPublicSupabase> | null,
): Promise<DiscoveryPost[]> {
  try {
    const supabase = contextSupabase ?? getPublicSupabase();
    let query = supabase
      .from("posts")
      .select(
        "id, trainer_id, kind, is_premium, caption, media_url, thumbnail_url, duration_seconds, respect_count, save_count, view_count, comment_count, created_at, is_demo",
      )
      .eq("is_published", true).eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(120);
    if (kind !== "all") query = query.eq("kind", kind);
    if (filters.excludeDemo) query = query.eq("is_demo", false);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const posts = rows ?? [];
    if (posts.length === 0) return [];

    const trainerIds = Array.from(new Set(posts.map((p) => p.trainer_id)));
    const [profilesRes, tpRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, country")
        .in("user_id", trainerIds),
      supabase
        .from("trainer_profiles")
        .select("user_id, is_verified, specialties")
        .in("user_id", trainerIds),
    ]);
    if (profilesRes.error) throw new Error(profilesRes.error.message);
    if (tpRes.error) throw new Error(tpRes.error.message);
    const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p]));
    const tpMap = new Map((tpRes.data ?? []).map((t) => [t.user_id, t]));

    // Apply trainer-level filters
    let filtered = posts.filter((p) => {
      const pr = profileMap.get(p.trainer_id);
      const tp = tpMap.get(p.trainer_id);
      if (!pr) return false;
      if (!tp) return false; // MUST HAVE TRAINER PROFILE
      if (filters.verifiedOnly && !tp?.is_verified) return false;
      if (filters.country && pr.country?.toLowerCase() !== filters.country.toLowerCase())
        return false;
      if (
        filters.specialty &&
        !(tp?.specialties ?? []).some(
          (s: string) => s.toLowerCase() === filters.specialty!.toLowerCase(),
        )
      )
        return false;
      return true;
    });

    const sort = filters.sort ?? "top";
    if (sort === "recent") {
      // already sorted by created_at desc
    } else if (sort === "random") {
      filtered = filtered
        .map((v) => ({ v, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .map(({ v }) => v);
    } else {
      filtered = [...filtered].sort((a, b) => scorePost(b) - scorePost(a));
    }

    filtered = filtered.slice(0, 60);
    const postIds = filtered.map((p) => p.id);
    const [commentRes, respectRes, saveRes] = await Promise.all([
      supabase
        .from("comments")
        .select("post_id")
        .in("post_id", postIds)
        .eq("status", "visible"),
      supabase
        .from("respects")
        .select("post_id")
        .in("post_id", postIds),
      supabase
        .from("saves")
        .select("post_id")
        .in("post_id", postIds),
    ]);

    const commentCountMap = new Map<string, number>();
    const respectCountMap = new Map<string, number>();
    const saveCountMap = new Map<string, number>();

    if (commentRes.data) {
      for (const r of commentRes.data) {
        commentCountMap.set(r.post_id, (commentCountMap.get(r.post_id) ?? 0) + 1);
      }
    }
    if (respectRes.data) {
      for (const r of respectRes.data) {
        respectCountMap.set(r.post_id, (respectCountMap.get(r.post_id) ?? 0) + 1);
      }
    }
    if (saveRes.data) {
      for (const r of saveRes.data) {
        saveCountMap.set(r.post_id, (saveCountMap.get(r.post_id) ?? 0) + 1);
      }
    }

    let currentUserId: string | null = contextUserId ?? null;
    const subscribedTrainerIds = new Set<string>();
    const unlockedPostIds = new Set<string>();

    if (currentUserId) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [subRes, unlockRes] = await Promise.all([
          (supabaseAdmin as any)
            .from("subscriptions")
            .select("trainer_id, status, current_period_end")
            .eq("subscriber_id", currentUserId),
          (supabaseAdmin as any)
            .from("post_unlocks")
            .select("post_id")
            .eq("user_id", currentUserId),
        ]);
        for (const s of subRes.data ?? []) {
          const isSubActive =
            ["active", "trial", "grace"].includes(s.status) &&
            (!s.current_period_end || new Date(s.current_period_end).getTime() > Date.now());
          if (s.trainer_id && isSubActive) {
            subscribedTrainerIds.add(s.trainer_id);
          }
        }
        for (const u of unlockRes.data ?? []) {
          if (u.post_id) unlockedPostIds.add(u.post_id);
        }
      } catch (e) {
        console.error("Error fetching subscriptions/unlocks in fetchDiscovery:", e);
      }
    }

    const signed = await decoratePosts(
      supabase,
      filtered,
      currentUserId,
      subscribedTrainerIds,
      unlockedPostIds,
    );
    return signed.map((p) => {
      const pr = profileMap.get(p.trainer_id);
      return {
        ...(p as Post),
        comment_count: resolveDiscoveryCount(
          commentCountMap,
          p.id,
          p.comment_count,
          commentRes.error,
        ),
        respect_count: resolveDiscoveryCount(
          respectCountMap,
          p.id,
          p.respect_count,
          respectRes.error,
        ),
        save_count: resolveDiscoveryCount(
          saveCountMap,
          p.id,
          p.save_count,
          saveRes.error,
        ),
        trainer: {
          user_id: p.trainer_id,
          username: pr?.username ?? null,
          display_name: pr?.display_name ?? null,
          avatar_url: pr?.avatar_url ?? null,
          is_verified: tpMap.get(p.trainer_id)?.is_verified ?? false,
        },
      };
    });
  } catch (err) {
    console.error("fetchDiscovery error:", err);
    return [];
  }
}

export const getDiscoveryFeed = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, optionalSupabaseAuth])
  .handler(async ({ context }): Promise<DiscoveryPost[]> =>
    fetchDiscovery("feed", { sort: "recent" }, context.userId, context.supabase),
  );

export const getShortsFeed = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, optionalSupabaseAuth])
  .handler(async ({ context }): Promise<DiscoveryPost[]> =>
    fetchDiscovery("short", { sort: "top" }, context.userId, context.supabase),
  );

export const getExplorePosts = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, optionalSupabaseAuth])
  .validator((input) =>
    z
      .object({
        kind: z.enum(["feed", "short", "all"]).default("all"),
        country: z.string().nullable().optional(),
        specialty: z.string().nullable().optional(),
        verifiedOnly: z.boolean().default(false),
        sort: z.enum(["top", "recent", "random"]).default("top"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<DiscoveryPost[]> =>
    fetchDiscovery(data.kind, data, context.userId, context.supabase),
  );

export const getExploreFacets = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ countries: string[]; specialties: string[] }> => {
    try {
      const supabase = getPublicSupabase();
      const [profRes, tpRes] = await Promise.all([
        supabase.from("profiles").select("country"),
        supabase.from("trainer_profiles").select("specialties"),
      ]);
      const countries = Array.from(
        new Set(
          (profRes.data ?? [])
            .map((r) => r.country)
            .filter((c): c is string => !!c && c.length > 0),
        ),
      ).sort();
      const specialties = Array.from(
        new Set(
          (tpRes.data ?? []).flatMap((r) => r.specialties ?? []) as string[],
        ),
      ).sort();
      return { countries, specialties };
    } catch {
      return { countries: [], specialties: [] };
    }
  },
);

export const getFollowCounts = createServerFn({ method: "POST" })
  .validator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<{ followers: number; following: number; subscribers: number }> => {
    const supabase = getPublicSupabase();
    const [followersRes, followingRes, subscribersRes] = await Promise.all([
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("trainer_id", data.userId),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", data.userId),
      supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("trainer_id", data.userId)
        .in("status", ["active", "trial", "grace"]),
    ]);
    if (followersRes.error) throw new Error(followersRes.error.message);
    if (followingRes.error) throw new Error(followingRes.error.message);
    if (subscribersRes.error) throw new Error(subscribersRes.error.message);
    return {
      followers: followersRes.count ?? 0,
      following: followingRes.count ?? 0,
      subscribers: subscribersRes.count ?? 0,
    };
  });

export const listTrainers = createServerFn({ method: "GET" }).handler(
  async (): Promise<TrainerSummary[]> => {
    const supabase = getPublicSupabase();
    const { data, error } = await supabase
      .from("trainer_profiles")
      .select(
        "user_id, subscription_price, is_verified, specialties, monetization_enabled",
      );
    if (error) throw new Error(error.message);
    const trainerIds = (data ?? []).map((t) => t.user_id);
    if (trainerIds.length === 0) return [];

    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, cover_url, country, bio, native_language, additional_languages")
      .in("user_id", trainerIds);
    if (pErr) throw new Error(pErr.message);

    const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    return (data ?? []).map((t) => {
      const p = profileMap.get(t.user_id);
      return {
        user_id: t.user_id,
        username: p?.username ?? null,
        display_name: p?.display_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        cover_url: p?.cover_url ?? null,
        country: p?.country ?? null,
        native_language: p?.native_language ?? null,
        additional_languages: p?.additional_languages ?? [],
        bio: p?.bio ?? null,
        specialties: t.specialties ?? [],
        subscription_price: Number(t.subscription_price ?? 0),
        is_verified: t.is_verified ?? false,
      };
    });
  },
);

export type FollowListEntry = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
};

async function hydrateProfiles(
  supabase: ReturnType<typeof getPublicSupabase>,
  ids: string[],
): Promise<FollowListEntry[]> {
  if (ids.length === 0) return [];
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, avatar_url, is_verified")
    .in("user_id", ids);
  if (error) throw new Error(error.message);
  const map = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  return ids
    .map((id) => {
      const p = map.get(id);
      if (!p) return null;
      return {
        user_id: p.user_id,
        username: p.username ?? null,
        display_name: p.display_name ?? null,
        avatar_url: p.avatar_url ?? null,
        is_verified: (p as { is_verified?: boolean }).is_verified ?? false,
      };
    })
    .filter((x): x is FollowListEntry => x !== null);
}

export const listFollowConnections = createServerFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        kind: z.enum(["followers", "following", "subscribers"]),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<FollowListEntry[]> => {
    const supabase = getPublicSupabase();
    let ids: string[] = [];
    if (data.kind === "followers") {
      const { data: rows, error } = await supabase
        .from("follows")
        .select("follower_id, created_at")
        .eq("trainer_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(data.limit);
      if (error) throw new Error(error.message);
      ids = (rows ?? []).map((r) => r.follower_id);
    } else if (data.kind === "following") {
      const { data: rows, error } = await supabase
        .from("follows")
        .select("trainer_id, created_at")
        .eq("follower_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(data.limit);
      if (error) throw new Error(error.message);
      ids = (rows ?? []).map((r) => r.trainer_id);
    } else {
      const { data: rows, error } = await supabase
        .from("subscriptions")
        .select("subscriber_id, created_at")
        .eq("trainer_id", data.userId)
        .in("status", ["active", "trial", "grace"])
        .order("created_at", { ascending: false })
        .limit(data.limit);
      if (error) throw new Error(error.message);
      ids = (rows ?? []).map((r) => (r as { subscriber_id: string }).subscriber_id);
    }
    return hydrateProfiles(supabase, ids);
  });

export type SpotlightTrainer = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  country: string | null;
  bio: string | null;
  specialties: string[];
  is_verified: boolean;
  subscription_price: number;
  programs: number;
  followers: number;
};

export const getSpotlightTrainers = createServerFn({ method: "GET" }).handler(
  async (): Promise<SpotlightTrainer[]> => {
    const supabase = getPublicSupabase();
    // Verified trainers first, then fall back to all.
    const { data: verified } = await supabase
      .from("trainer_profiles")
      .select("user_id, subscription_price, is_verified, specialties")
      .eq("is_verified", true)
      .limit(12);
    let rows = verified ?? [];
    if (rows.length === 0) {
      const { data: all } = await supabase
        .from("trainer_profiles")
        .select("user_id, subscription_price, is_verified, specialties")
        .limit(12);
      rows = all ?? [];
    }
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.user_id);
    const [profRes, postCountRes, followRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, cover_url, country, bio")
        .in("user_id", ids),
      supabase
        .from("posts")
        .select("trainer_id")
        .in("trainer_id", ids),
      supabase
        .from("follows")
        .select("trainer_id")
        .in("trainer_id", ids),
    ]);
    const profMap = new Map((profRes.data ?? []).map((p) => [p.user_id, p]));
    const programCounts = new Map<string, number>();
    for (const p of postCountRes.data ?? []) {
      programCounts.set(p.trainer_id, (programCounts.get(p.trainer_id) ?? 0) + 1);
    }
    const followCounts = new Map<string, number>();
    for (const f of followRes.data ?? []) {
      followCounts.set(f.trainer_id, (followCounts.get(f.trainer_id) ?? 0) + 1);
    }
    return rows.map((t) => {
      const p = profMap.get(t.user_id);
      return {
        user_id: t.user_id,
        username: p?.username ?? null,
        display_name: p?.display_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        cover_url: p?.cover_url ?? null,
        country: p?.country ?? null,
        bio: p?.bio ?? null,
        specialties: t.specialties ?? [],
        is_verified: t.is_verified ?? false,
        subscription_price: Number(t.subscription_price ?? 0),
        programs: programCounts.get(t.user_id) ?? 0,
        followers: followCounts.get(t.user_id) ?? 0,
      };
    });
  },
);

export const findSimilarTrainers = createServerFn({ method: "POST" })
  .validator((input) => z.object({ query: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data }): Promise<TrainerSummary[]> => {
    const supabase = getPublicSupabase();
    const q = data.query.replace(/[%_]/g, "").toLowerCase();
    if (!q) return [];
    const like = `%${q}%`;
    // Fetch candidate profiles by fuzzy match on username / display_name,
    // then join to trainer_profiles to keep only trainers.
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, cover_url, country, bio")
      .or(`username.ilike.${like},display_name.ilike.${like}`)
      .limit(24);
    if (pErr) throw new Error(pErr.message);
    const ids = (profiles ?? []).map((p) => p.user_id);
    if (ids.length === 0) return [];
    const { data: tps, error: tErr } = await supabase
      .from("trainer_profiles")
      .select("user_id, subscription_price, is_verified, specialties, monetization_enabled")
      .in("user_id", ids);
    if (tErr) throw new Error(tErr.message);
    const tpMap = new Map((tps ?? []).map((t) => [t.user_id, t]));
    const results: TrainerSummary[] = [];
    for (const p of profiles ?? []) {
      const tp = tpMap.get(p.user_id);
      if (!tp) continue;
      results.push({
        user_id: p.user_id,
        username: p.username ?? null,
        display_name: p.display_name ?? null,
        avatar_url: p.avatar_url ?? null,
        cover_url: p.cover_url ?? null,
        country: p.country ?? null,
        bio: p.bio ?? null,
        specialties: tp.specialties ?? [],
        subscription_price: Number(tp.subscription_price ?? 0),
        is_verified: tp.is_verified ?? false,
      });
      if (results.length >= 6) break;
    }
    return results;
  });

export const getTrainerByUsername = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, optionalSupabaseAuth])
  .validator((input) => z.object({ username: z.string() }).parse(input))
  .handler(async ({ data, context }): Promise<TrainerDetail | null> => {
    const supabase = (context.supabase as ReturnType<typeof getPublicSupabase>) ?? getPublicSupabase();
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, cover_url, country, bio")
      .eq("username", data.username)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile) return null;

    const { data: tp, error: tErr } = await supabase
      .from("trainer_profiles")
      .select(
        "user_id, subscription_price, is_verified, specialties, value_proposition, monetization_enabled, dms_enabled",
      )
      .eq("user_id", profile.user_id)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!tp) return null;

    const { data: posts, error: postErr } = await supabase
      .from("posts")
      .select(
        "id, trainer_id, kind, is_premium, caption, media_url, thumbnail_url, duration_seconds, respect_count, save_count, view_count, comment_count, created_at",
      )
      .eq("trainer_id", profile.user_id)
      .eq("is_published", true).eq("is_hidden", false)
      .order("created_at", { ascending: false });
    if (postErr) throw new Error(postErr.message);

    const rawPosts = posts ?? [];
    let currentUserId: string | null = context.userId ?? null;
    const subscribedTrainerIds = new Set<string>();
    const unlockedPostIds = new Set<string>();

    if (currentUserId) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [subRes, unlockRes] = await Promise.all([
          (supabaseAdmin as any)
            .from("subscriptions")
            .select("trainer_id, status, current_period_end")
            .eq("subscriber_id", currentUserId),
          (supabaseAdmin as any)
            .from("post_unlocks")
            .select("post_id")
            .eq("user_id", currentUserId),
        ]);
        for (const s of subRes.data ?? []) {
          const isSubActive =
            ["active", "trial", "grace"].includes(s.status) &&
            (!s.current_period_end || new Date(s.current_period_end).getTime() > Date.now());
          if (s.trainer_id && isSubActive) {
            subscribedTrainerIds.add(s.trainer_id);
          }
        }
        for (const u of unlockRes.data ?? []) {
          if (u.post_id) unlockedPostIds.add(u.post_id);
        }
      } catch (e) {
        console.error("Error fetching subscriptions/unlocks in getTrainerByUsername:", e);
      }
    }

    const signedPosts = await decoratePosts(
      supabase,
      rawPosts,
      currentUserId,
      subscribedTrainerIds,
      unlockedPostIds,
    );

    // Community threads authored by this trainer or targeted at this trainer.
    const { data: comm, error: cmErr } = await supabase
      .from("community_posts")
      .select(
        "id, kind, title, body, hashtags, respect_count, comment_count, trainer_answered, coaching_status, created_at, target_trainer_id, author_id",
      )
      .or(`author_id.eq.${profile.user_id},target_trainer_id.eq.${profile.user_id}`)
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .limit(24);
    if (cmErr) throw new Error(cmErr.message);
    const community_posts: TrainerCommunityPost[] = (comm ?? []).map((c) => ({
      id: c.id,
      kind: c.kind as "question" | "flex",
      title: c.title,
      body: c.body,
      hashtags: c.hashtags ?? [],
      respect_count: c.respect_count ?? 0,
      comment_count: c.comment_count ?? 0,
      trainer_answered: c.trainer_answered ?? false,
      coaching_status: (c.coaching_status ?? null) as TrainerCommunityPost["coaching_status"],
      created_at: c.created_at,
      author_id: c.author_id,
      target_trainer_id: c.target_trainer_id,
    }));

    return {
      user_id: profile.user_id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      cover_url: profile.cover_url,
      country: profile.country,
      bio: profile.bio,
      specialties: tp.specialties ?? [],
      subscription_price: Number(tp.subscription_price ?? 0),
      is_verified: tp.is_verified ?? false,
      value_proposition: tp.value_proposition ?? "",
      monetization_enabled: tp.monetization_enabled ?? false,
      dms_enabled: (tp as { dms_enabled?: boolean }).dms_enabled ?? true,
      posts: signedPosts as Post[],
      community_posts,
    };
  });

export type PostDetail = DiscoveryPost & {
  is_hidden: boolean;
  trainer: DiscoveryPost["trainer"] & {
    bio: string | null;
    country: string | null;
  };
};

export const getPostDetail = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, optionalSupabaseAuth])
  .validator((input) => z.object({ postId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<PostDetail | null> => {
    const supabase = (context.supabase as ReturnType<typeof getPublicSupabase>) ?? getPublicSupabase();
    const { data: post, error } = await supabase
      .from("posts")
      .select(
        "id, trainer_id, kind, is_premium, caption, media_url, thumbnail_url, duration_seconds, respect_count, save_count, view_count, comment_count, created_at, is_published, is_hidden",
      )
      .eq("id", data.postId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!post || !post.is_published || post.is_hidden) return null;

    const [profRes, tpRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, country, bio")
        .eq("user_id", post.trainer_id)
        .maybeSingle(),
      supabase
        .from("trainer_profiles")
        .select("user_id, is_verified")
        .eq("user_id", post.trainer_id)
        .maybeSingle(),
    ]);
    if (profRes.error) throw new Error(profRes.error.message);
    const profile = profRes.data;
    if (!profile) return null;

    let currentUserId: string | null = context.userId ?? null;
    const subscribedTrainerIds = new Set<string>();
    const unlockedPostIds = new Set<string>();

    if (currentUserId) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [subRes, unlockRes] = await Promise.all([
          (supabaseAdmin as any)
            .from("subscriptions")
            .select("trainer_id, status, current_period_end")
            .eq("subscriber_id", currentUserId),
          (supabaseAdmin as any)
            .from("post_unlocks")
            .select("post_id")
            .eq("user_id", currentUserId),
        ]);
        for (const s of subRes.data ?? []) {
          const isSubActive =
            ["active", "trial", "grace"].includes(s.status) &&
            (!s.current_period_end || new Date(s.current_period_end).getTime() > Date.now());
          if (s.trainer_id && isSubActive) {
            subscribedTrainerIds.add(s.trainer_id);
          }
        }
        for (const u of unlockRes.data ?? []) {
          if (u.post_id) unlockedPostIds.add(u.post_id);
        }
      } catch (e) {
        console.error("Error fetching subscriptions/unlocks in getPostDetail:", e);
      }
    }

    const [signed] = await decoratePosts(
      supabase,
      [
        {
          id: post.id,
          trainer_id: post.trainer_id,
          kind: post.kind as "feed" | "short",
          is_premium: post.is_premium,
          caption: post.caption,
          media_url: post.media_url,
          thumbnail_url: post.thumbnail_url,
          duration_seconds: post.duration_seconds,
          respect_count: post.respect_count ?? 0,
          save_count: post.save_count ?? 0,
          view_count: post.view_count ?? 0,
          comment_count: post.comment_count ?? 0,
          created_at: post.created_at,
        },
      ],
      currentUserId,
      subscribedTrainerIds,
      unlockedPostIds,
    );

    return {
      ...(signed as Post),
      is_hidden: post.is_hidden,
      trainer: {
        user_id: profile.user_id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        is_verified: tpRes.data?.is_verified ?? false,
        bio: profile.bio ?? null,
        country: profile.country ?? null,
      },
    };
  });
