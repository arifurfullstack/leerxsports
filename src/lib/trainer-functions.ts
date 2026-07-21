import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function getPublicSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
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

export type TrainerDetail = TrainerSummary & {
  value_proposition: string;
  monetization_enabled: boolean;
  dms_enabled: boolean;
  posts: Post[];
  classes: TrainerClass[];
  community_posts: TrainerCommunityPost[];
};

export type TrainerClass = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  level: string | null;
  duration_minutes: number | null;
  schedule: string;
  location: string | null;
  price: number;
  image_url: string | null;
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
  created_at: string;
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

async function decoratePosts<T extends { media_url: string; thumbnail_url: string | null }>(
  supabase: ReturnType<typeof getPublicSupabase>,
  posts: T[],
): Promise<T[]> {
  // Never sign URLs for premium content on the public path — those are
  // gated server-side via getPremiumPostUrls after subscription check.
  const paths = posts
    .flatMap((p) => [
      (p as { is_premium?: boolean }).is_premium ? null : p.media_url,
      (p as { is_premium?: boolean }).is_premium ? null : p.thumbnail_url,
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
  return posts.map((p) => {
    if ((p as { is_premium?: boolean }).is_premium) {
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
): Promise<DiscoveryPost[]> {
  const supabase = getPublicSupabase();
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
    // Require an author profile, but not a trainer profile — the feed shows
    // posts from every user (athletes and trainers alike).
    if (!pr) return false;
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
  const signed = await decoratePosts(supabase, filtered);
  return signed.map((p) => {
    const pr = profileMap.get(p.trainer_id);
    return {
      ...(p as Post),
      trainer: {
        user_id: p.trainer_id,
        username: pr?.username ?? null,
        display_name: pr?.display_name ?? null,
        avatar_url: pr?.avatar_url ?? null,
        is_verified: tpMap.get(p.trainer_id)?.is_verified ?? false,
      },
    };
  });
}

export const getDiscoveryFeed = createServerFn({ method: "GET" }).handler(
  async (): Promise<DiscoveryPost[]> =>
    fetchDiscovery("feed", { sort: "recent" }),
);

export const getShortsFeed = createServerFn({ method: "GET" }).handler(
  async (): Promise<DiscoveryPost[]> => fetchDiscovery("short", { sort: "top" }),
);

export const getExplorePosts = createServerFn({ method: "POST" })
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
  .handler(async ({ data }): Promise<DiscoveryPost[]> => fetchDiscovery(data.kind, data));

export const getExploreFacets = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ countries: string[]; specialties: string[] }> => {
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
      .select("user_id, username, display_name, avatar_url, cover_url, country, bio")
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
        bio: p?.bio ?? null,
        specialties: t.specialties ?? [],
        subscription_price: Number(t.subscription_price ?? 0),
        is_verified: t.is_verified ?? false,
      };
    });
  },
);

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
  .validator((input) => z.object({ username: z.string() }).parse(input))
  .handler(async ({ data }): Promise<TrainerDetail | null> => {
    const supabase = getPublicSupabase();
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

    // Generate signed URLs for storage paths (bucket is private).
    const rawPosts = posts ?? [];
    // Premium posts are gated: never sign their URLs on the public path.
    const paths = rawPosts
      .flatMap((p) => (p.is_premium ? [] : [p.media_url, p.thumbnail_url]))
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
    const signedPosts = rawPosts.map((p) => {
      if (p.is_premium) return { ...p, media_url: "", thumbnail_url: null };
      return {
        ...p,
        media_url: signedMap.get(p.media_url) ?? p.media_url,
        thumbnail_url: p.thumbnail_url
          ? signedMap.get(p.thumbnail_url) ?? p.thumbnail_url
          : null,
      };
    });

    // Sports classes: linked by instructor text — match display_name or username.
    const instructorNames = [profile.display_name, profile.username].filter(
      (v): v is string => !!v,
    );
    let classes: TrainerClass[] = [];
    if (instructorNames.length > 0) {
      const { data: cls, error: cErr } = await supabase
        .from("sports_classes")
        .select(
          "id, title, slug, description, category, level, duration_minutes, schedule, location, price, image_url",
        )
        .eq("is_active", true)
        .in("instructor", instructorNames)
        .gte("schedule", new Date().toISOString())
        .order("schedule", { ascending: true })
        .limit(24);
      if (cErr) throw new Error(cErr.message);
      classes = (cls ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        description: c.description,
        category: c.category,
        level: c.level,
        duration_minutes: c.duration_minutes,
        schedule: c.schedule,
        location: c.location,
        price: Number(c.price ?? 0),
        image_url: c.image_url,
      }));
    }

    // Community threads authored by this trainer.
    const { data: comm, error: cmErr } = await supabase
      .from("community_posts")
      .select(
        "id, kind, title, body, hashtags, respect_count, comment_count, trainer_answered, created_at",
      )
      .eq("author_id", profile.user_id)
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
      created_at: c.created_at,
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
      classes,
      community_posts,
    };
  });

export const listTrainerClasses = createServerFn({ method: "GET" })
  .validator((input) =>
    z
      .object({
        username: z.string(),
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(50).default(12),
        sort: z
          .enum(["date-asc", "date-desc", "price-asc", "price-desc"])
          .default("date-asc"),
        category: z.string().nullable().optional(),
        level: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(
    async ({
      data,
    }): Promise<{ items: TrainerClass[]; nextOffset: number | null }> => {
      const supabase = getPublicSupabase();
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("username", data.username)
        .maybeSingle();
      if (pErr) throw new Error(pErr.message);
      if (!profile) return { items: [], nextOffset: null };
      const instructorNames = [profile.display_name, profile.username].filter(
        (v): v is string => !!v,
      );
      if (instructorNames.length === 0) return { items: [], nextOffset: null };
      const from = data.offset;
      const to = data.offset + data.limit - 1;
      const orderMap = {
        "date-asc": { col: "schedule", ascending: true },
        "date-desc": { col: "schedule", ascending: false },
        "price-asc": { col: "price", ascending: true },
        "price-desc": { col: "price", ascending: false },
      } as const;
      const ord = orderMap[data.sort];
      let q = supabase
        .from("sports_classes")
        .select(
          "id, title, slug, description, category, level, duration_minutes, schedule, location, price, image_url",
        )
        .eq("is_active", true)
        .in("instructor", instructorNames)
        .gte("schedule", new Date().toISOString());
      if (data.category) q = q.eq("category", data.category);
      if (data.level) q = q.eq("level", data.level);
      const { data: cls, error: cErr } = await q
        .order(ord.col, { ascending: ord.ascending })
        .range(from, to);
      if (cErr) throw new Error(cErr.message);
      const items: TrainerClass[] = (cls ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        description: c.description,
        category: c.category,
        level: c.level,
        duration_minutes: c.duration_minutes,
        schedule: c.schedule,
        location: c.location,
        price: Number(c.price ?? 0),
        image_url: c.image_url,
      }));
      const nextOffset = items.length < data.limit ? null : data.offset + items.length;
      return { items, nextOffset };
    },
  );

export type PostDetail = DiscoveryPost & {
  is_hidden: boolean;
  trainer: DiscoveryPost["trainer"] & {
    bio: string | null;
    country: string | null;
  };
};

export const getPostDetail = createServerFn({ method: "GET" })
  .validator((input) => z.object({ postId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<PostDetail | null> => {
    const supabase = getPublicSupabase();
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

    const [signed] = await decoratePosts(supabase, [
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
    ]);

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