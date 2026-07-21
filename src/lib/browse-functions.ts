import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

// ---------------------------------------------------------------------------
// Public Supabase client (publishable key). Reads rely on the anon SELECT
// policies that already exist on profiles / trainer_profiles / posts /
// sports_classes / community_posts / community_comments.
// ---------------------------------------------------------------------------
function getPublicSupabase() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

// Kill supabase-js's expensive select-string parsing at the type level.
const sel = (s: string): string => s;

export const PAGE_SIZE = 24;

function pageRange(page: number): [number, number] {
  const p = Math.max(1, page | 0);
  const from = (p - 1) * PAGE_SIZE;
  return [from, from + PAGE_SIZE - 1];
}

function escapeIlike(input: string): string {
  // Escape %/_ + PostgREST or() delimiters so a query like "a,b" doesn't
  // break out of the .ilike filter.
  return input.replace(/[%,_()]/g, (m) => `\\${m}`);
}

type Paged<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

// ---------------------------------------------------------------------------
// FACETS
// ---------------------------------------------------------------------------
export type BrowseFacets = {
  countries: string[];
  specialties: string[];
  classCategories: string[];
  classLevels: string[];
};

export const getBrowseFacets = createServerFn({ method: "GET" }).handler(
  async (): Promise<BrowseFacets> => {
    const supabase = getPublicSupabase();
    const [prof, tp, cls] = await Promise.all([
      supabase.from("profiles").select(sel("country")).returns<{ country: string | null }[]>(),
      supabase.from("trainer_profiles").select(sel("specialties")).returns<{ specialties: string[] | null }[]>(),
      supabase.from("sports_classes").select(sel("category, level")).eq("is_active", true).returns<{ category: string | null; level: string | null }[]>(),
    ]);
    const countries = uniqSort((prof.data ?? []).map((r) => r.country));
    const specialties = uniqSort((tp.data ?? []).flatMap((r) => r.specialties ?? []));
    const classCategories = uniqSort((cls.data ?? []).map((r) => r.category));
    const classLevels = uniqSort((cls.data ?? []).map((r) => r.level));
    return { countries, specialties, classCategories, classLevels };
  },
);

function uniqSort(values: (string | null | undefined)[]): string[] {
  return Array.from(
    new Set(values.filter((v): v is string => !!v && v.length > 0)),
  ).sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// TRAINERS
// ---------------------------------------------------------------------------
export type BrowseTrainer = {
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
  post_count: number;
};

const trainerSortSchema = z.enum(["featured", "new", "price_low", "price_high"]);

export const browseTrainers = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        q: z.string().default(""),
        country: z.string().nullable().default(null),
        specialty: z.string().nullable().default(null),
        verifiedOnly: z.boolean().default(false),
        sort: trainerSortSchema.default("featured"),
        page: z.number().int().min(1).default(1),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<Paged<BrowseTrainer>> => {
    const supabase = getPublicSupabase();
    const [from, to] = pageRange(data.page);

    // 1) Build trainer_profiles filter (verified / specialty).
    type TpRow = {
      user_id: string;
      subscription_price: number | null;
      is_verified: boolean | null;
      specialties: string[] | null;
    };
    let tpq = supabase
      .from("trainer_profiles")
      .select(sel("user_id, subscription_price, is_verified, specialties"));
    if (data.verifiedOnly) tpq = tpq.eq("is_verified", true);
    if (data.specialty) tpq = tpq.contains("specialties", [data.specialty]);
    const tpRes = await tpq.returns<TpRow[]>();
    if (tpRes.error) throw new Error(tpRes.error.message);
    const tpRows = tpRes.data ?? [];
    const tpById = new Map(tpRows.map((r) => [r.user_id, r]));
    const candidateIds = tpRows.map((r) => r.user_id);
    if (candidateIds.length === 0) {
      return { items: [], total: 0, page: data.page, pageSize: PAGE_SIZE };
    }

    // 2) Profile filter (country + text search) restricted to candidates.
    type ProfRow = {
      user_id: string;
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
      cover_url: string | null;
      country: string | null;
      bio: string | null;
      created_at: string;
    };
    let pq = supabase
      .from("profiles")
      .select(
        sel(
          "user_id, username, display_name, avatar_url, cover_url, country, bio, created_at",
        ),
        { count: "exact" },
      )
      .in("user_id", candidateIds);
    if (data.country) pq = pq.ilike("country", data.country);
    if (data.q.trim()) {
      const q = `%${escapeIlike(data.q.trim())}%`;
      pq = pq.or(
        `username.ilike.${q},display_name.ilike.${q},bio.ilike.${q}`,
      );
    }
    // Sorting
    if (data.sort === "new") pq = pq.order("created_at", { ascending: false });
    else pq = pq.order("display_name", { ascending: true, nullsFirst: false });

    // For price-based sort we need to pull all filtered ids first, sort by
    // price from trainer_profiles, then paginate. Keeps the query builder
    // simple and correct.
    const priceSort = data.sort === "price_low" || data.sort === "price_high";

    if (priceSort) {
      const allRes = await pq.returns<ProfRow[]>();
      if (allRes.error) throw new Error(allRes.error.message);
      const all = allRes.data ?? [];
      const sorted = [...all].sort((a, b) => {
        const pa = Number(tpById.get(a.user_id)?.subscription_price ?? 0);
        const pb = Number(tpById.get(b.user_id)?.subscription_price ?? 0);
        return data.sort === "price_low" ? pa - pb : pb - pa;
      });
      const pageItems = sorted.slice(from, to + 1);
      const items = await hydrateTrainers(supabase, pageItems, tpById);
      return {
        items,
        total: allRes.count ?? sorted.length,
        page: data.page,
        pageSize: PAGE_SIZE,
      };
    }

    const pageRes = await pq.range(from, to).returns<ProfRow[]>();
    if (pageRes.error) throw new Error(pageRes.error.message);
    const items = await hydrateTrainers(supabase, pageRes.data ?? [], tpById);
    return {
      items,
      total: pageRes.count ?? items.length,
      page: data.page,
      pageSize: PAGE_SIZE,
    };
  });

async function hydrateTrainers(
  supabase: ReturnType<typeof getPublicSupabase>,
  profiles: Array<{
    user_id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    cover_url: string | null;
    country: string | null;
    bio: string | null;
  }>,
  tpById: Map<
    string,
    { subscription_price: number | null; is_verified: boolean | null; specialties: string[] | null }
  >,
): Promise<BrowseTrainer[]> {
  if (profiles.length === 0) return [];
  const ids = profiles.map((p) => p.user_id);
  // Count posts per trainer (in one query, then group in memory).
  type PostRow = { trainer_id: string };
  const { data: postRows } = await supabase
    .from("posts")
    .select(sel("trainer_id"))
    .in("trainer_id", ids)
    .eq("is_published", true)
    .eq("is_hidden", false)
    .returns<PostRow[]>();
  const countMap = new Map<string, number>();
  for (const r of postRows ?? []) {
    countMap.set(r.trainer_id, (countMap.get(r.trainer_id) ?? 0) + 1);
  }
  // Sort: featured = verified first, then higher post_count.
  return profiles.map((p) => {
    const tp = tpById.get(p.user_id);
    return {
      user_id: p.user_id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      cover_url: p.cover_url,
      country: p.country,
      bio: p.bio,
      specialties: tp?.specialties ?? [],
      subscription_price: Number(tp?.subscription_price ?? 0),
      is_verified: tp?.is_verified ?? false,
      post_count: countMap.get(p.user_id) ?? 0,
    };
  });
}

// ---------------------------------------------------------------------------
// CLASSES
// ---------------------------------------------------------------------------
export type BrowseClass = {
  id: string;
  slug: string;
  title: string;
  instructor: string;
  category: string | null;
  level: string;
  price: number;
  image_url: string | null;
  schedule: string;
  duration_minutes: number;
  capacity: number;
  location: string | null;
};

const classSortSchema = z.enum([
  "soonest",
  "new",
  "price_low",
  "price_high",
]);

export const browseClasses = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        q: z.string().default(""),
        category: z.string().nullable().default(null),
        level: z.string().nullable().default(null),
        sort: classSortSchema.default("soonest"),
        page: z.number().int().min(1).default(1),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<Paged<BrowseClass>> => {
    const supabase = getPublicSupabase();
    const [from, to] = pageRange(data.page);
    type Row = BrowseClass;
    let q = supabase
      .from("sports_classes")
      .select(
        sel(
          "id, slug, title, instructor, category, level, price, image_url, schedule, duration_minutes, capacity, location",
        ),
        { count: "exact" },
      )
      .eq("is_active", true);
    if (data.category) q = q.ilike("category", data.category);
    if (data.level) q = q.ilike("level", data.level);
    if (data.q.trim()) {
      const s = `%${escapeIlike(data.q.trim())}%`;
      q = q.or(`title.ilike.${s},instructor.ilike.${s},description.ilike.${s}`);
    }
    switch (data.sort) {
      case "new":
        q = q.order("created_at", { ascending: false });
        break;
      case "price_low":
        q = q.order("price", { ascending: true });
        break;
      case "price_high":
        q = q.order("price", { ascending: false });
        break;
      default:
        q = q.order("schedule", { ascending: true });
    }
    const res = await q.range(from, to).returns<Row[]>();
    if (res.error) throw new Error(res.error.message);
    return {
      items: (res.data ?? []).map((r) => ({ ...r, price: Number(r.price ?? 0) })),
      total: res.count ?? 0,
      page: data.page,
      pageSize: PAGE_SIZE,
    };
  });

// ---------------------------------------------------------------------------
// POSTS
// ---------------------------------------------------------------------------
export type BrowsePost = {
  id: string;
  trainer_id: string;
  kind: "feed" | "short";
  is_premium: boolean;
  caption: string | null;
  media_url: string;
  thumbnail_url: string | null;
  respect_count: number;
  comment_count: number;
  save_count: number;
  created_at: string;
  trainer: {
    user_id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    country: string | null;
    is_verified: boolean;
    specialties: string[];
  };
};

const postSortSchema = z.enum(["top", "new"]);

export const browsePosts = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        q: z.string().default(""),
        kind: z.enum(["feed", "short", "all"]).default("all"),
        country: z.string().nullable().default(null),
        specialty: z.string().nullable().default(null),
        verifiedOnly: z.boolean().default(false),
        sort: postSortSchema.default("new"),
        page: z.number().int().min(1).default(1),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<Paged<BrowsePost>> => {
    const supabase = getPublicSupabase();
    const [from, to] = pageRange(data.page);

    // Optionally narrow to a trainer id list first if trainer-side filters are set.
    let trainerIdFilter: string[] | null = null;
    if (data.verifiedOnly || data.specialty || data.country) {
      type TpRow = { user_id: string };
      let tpq = supabase
        .from("trainer_profiles")
        .select(sel("user_id"));
      if (data.verifiedOnly) tpq = tpq.eq("is_verified", true);
      if (data.specialty) tpq = tpq.contains("specialties", [data.specialty]);
      const tpRes = await tpq.returns<TpRow[]>();
      if (tpRes.error) throw new Error(tpRes.error.message);
      let ids = (tpRes.data ?? []).map((r) => r.user_id);
      if (data.country && ids.length > 0) {
        const pRes = await supabase
          .from("profiles")
          .select(sel("user_id"))
          .in("user_id", ids)
          .ilike("country", data.country)
          .returns<{ user_id: string }[]>();
        if (pRes.error) throw new Error(pRes.error.message);
        ids = (pRes.data ?? []).map((r) => r.user_id);
      }
      trainerIdFilter = ids;
      if (ids.length === 0) {
        return { items: [], total: 0, page: data.page, pageSize: PAGE_SIZE };
      }
    }

    type PostRow = {
      id: string;
      trainer_id: string;
      kind: "feed" | "short";
      is_premium: boolean;
      caption: string | null;
      media_url: string;
      thumbnail_url: string | null;
      respect_count: number;
      comment_count: number;
      save_count: number;
      created_at: string;
    };
    let pq = supabase
      .from("posts")
      .select(
        sel(
          "id, trainer_id, kind, is_premium, caption, media_url, thumbnail_url, respect_count, comment_count, save_count, created_at",
        ),
        { count: "exact" },
      )
      .eq("is_published", true)
      .eq("is_hidden", false);
    if (data.kind !== "all") pq = pq.eq("kind", data.kind);
    if (trainerIdFilter) pq = pq.in("trainer_id", trainerIdFilter);
    if (data.q.trim()) {
      const s = `%${escapeIlike(data.q.trim())}%`;
      pq = pq.ilike("caption", s);
    }
    if (data.sort === "top") {
      pq = pq.order("respect_count", { ascending: false }).order("created_at", {
        ascending: false,
      });
    } else {
      pq = pq.order("created_at", { ascending: false });
    }
    const res = await pq.range(from, to).returns<PostRow[]>();
    if (res.error) throw new Error(res.error.message);
    const rows = res.data ?? [];
    if (rows.length === 0) {
      return { items: [], total: res.count ?? 0, page: data.page, pageSize: PAGE_SIZE };
    }

    // Hydrate trainer summary for the visible page only.
    const trainerIds = Array.from(new Set(rows.map((r) => r.trainer_id)));
    const [profRes, tpRes] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          sel("user_id, username, display_name, avatar_url, country"),
        )
        .in("user_id", trainerIds)
        .returns<
          {
            user_id: string;
            username: string | null;
            display_name: string | null;
            avatar_url: string | null;
            country: string | null;
          }[]
        >(),
      supabase
        .from("trainer_profiles")
        .select(sel("user_id, is_verified, specialties"))
        .in("user_id", trainerIds)
        .returns<{ user_id: string; is_verified: boolean | null; specialties: string[] | null }[]>(),
    ]);
    const profMap = new Map((profRes.data ?? []).map((p) => [p.user_id, p]));
    const tpMap = new Map((tpRes.data ?? []).map((t) => [t.user_id, t]));

    const items: BrowsePost[] = rows.map((r) => {
      const p = profMap.get(r.trainer_id);
      const tp = tpMap.get(r.trainer_id);
      return {
        ...r,
        media_url: r.is_premium ? "" : r.media_url,
        thumbnail_url: r.is_premium ? null : r.thumbnail_url,
        trainer: {
          user_id: r.trainer_id,
          username: p?.username ?? null,
          display_name: p?.display_name ?? null,
          avatar_url: p?.avatar_url ?? null,
          country: p?.country ?? null,
          is_verified: tp?.is_verified ?? false,
          specialties: tp?.specialties ?? [],
        },
      };
    });

    return {
      items,
      total: res.count ?? items.length,
      page: data.page,
      pageSize: PAGE_SIZE,
    };
  });

// ---------------------------------------------------------------------------
// COMMUNITY
// ---------------------------------------------------------------------------
export type BrowseCommunityPost = {
  id: string;
  kind: "question" | "flex";
  title: string;
  body: string;
  hashtags: string[];
  respect_count: number;
  comment_count: number;
  trainer_answered: boolean;
  created_at: string;
  author: {
    user_id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_trainer: boolean;
  };
  top_reply: {
    body: string;
    author_display: string | null;
    is_trainer: boolean;
  } | null;
};

const communitySortSchema = z.enum(["new", "top", "trending"]);

export const browseCommunity = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        q: z.string().default(""),
        kind: z.enum(["question", "flex", "all"]).default("all"),
        trainerAnswered: z.boolean().default(false),
        sort: communitySortSchema.default("new"),
        page: z.number().int().min(1).default(1),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<Paged<BrowseCommunityPost>> => {
    const supabase = getPublicSupabase();
    const [from, to] = pageRange(data.page);

    type Row = {
      id: string;
      author_id: string;
      kind: "question" | "flex";
      title: string;
      body: string;
      hashtags: string[];
      respect_count: number;
      comment_count: number;
      trainer_answered: boolean;
      created_at: string;
    };
    let q = supabase
      .from("community_posts")
      .select(
        sel(
          "id, author_id, kind, title, body, hashtags, respect_count, comment_count, trainer_answered, created_at",
        ),
        { count: "exact" },
      )
      .eq("status", "visible");
    if (data.kind !== "all") q = q.eq("kind", data.kind);
    if (data.trainerAnswered) q = q.eq("trainer_answered", true);
    if (data.q.trim()) {
      const s = `%${escapeIlike(data.q.trim())}%`;
      q = q.or(`title.ilike.${s},body.ilike.${s}`);
    }
    if (data.sort === "top") {
      q = q.order("respect_count", { ascending: false }).order("created_at", { ascending: false });
    } else if (data.sort === "trending") {
      q = q.order("comment_count", { ascending: false }).order("created_at", { ascending: false });
    } else {
      q = q.order("created_at", { ascending: false });
    }
    const res = await q.range(from, to).returns<Row[]>();
    if (res.error) throw new Error(res.error.message);
    const rows = res.data ?? [];
    if (rows.length === 0) {
      return { items: [], total: res.count ?? 0, page: data.page, pageSize: PAGE_SIZE };
    }

    const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
    const postIds = rows.map((r) => r.id);
    const [profRes, trainerRes, repliesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select(sel("user_id, username, display_name, avatar_url"))
        .in("user_id", authorIds)
        .returns<
          { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null }[]
        >(),
      supabase
        .from("trainer_profiles")
        .select(sel("user_id"))
        .in("user_id", authorIds)
        .returns<{ user_id: string }[]>(),
      supabase
        .from("community_comments")
        .select(sel("id, post_id, author_id, body, created_at"))
        .in("post_id", postIds)
        .eq("status", "visible")
        .order("created_at", { ascending: true })
        .returns<{ id: string; post_id: string; author_id: string; body: string; created_at: string }[]>(),
    ]);
    const profMap = new Map((profRes.data ?? []).map((p) => [p.user_id, p]));
    const trainerSet = new Set((trainerRes.data ?? []).map((t) => t.user_id));
    // For top reply per post, pick the earliest by a trainer if any, else earliest overall.
    const replies = repliesRes.data ?? [];
    // Fetch reply-author profiles too for display names.
    const replyAuthorIds = Array.from(new Set(replies.map((r) => r.author_id))).filter(
      (id) => !profMap.has(id),
    );
    if (replyAuthorIds.length > 0) {
      const { data: extra } = await supabase
        .from("profiles")
        .select(sel("user_id, username, display_name, avatar_url"))
        .in("user_id", replyAuthorIds)
        .returns<
          { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null }[]
        >();
      const extraTrainerRes = await supabase
        .from("trainer_profiles")
        .select(sel("user_id"))
        .in("user_id", replyAuthorIds)
        .returns<{ user_id: string }[]>();
      for (const p of extra ?? []) profMap.set(p.user_id, p);
      for (const t of extraTrainerRes.data ?? []) trainerSet.add(t.user_id);
    }
    const topReplyByPost = new Map<
      string,
      { body: string; author_display: string | null; is_trainer: boolean }
    >();
    for (const r of replies) {
      const isTrainer = trainerSet.has(r.author_id);
      const existing = topReplyByPost.get(r.post_id);
      if (!existing || (!existing.is_trainer && isTrainer)) {
        const p = profMap.get(r.author_id);
        topReplyByPost.set(r.post_id, {
          body: r.body,
          author_display: p?.display_name ?? p?.username ?? null,
          is_trainer: isTrainer,
        });
      }
    }

    const items: BrowseCommunityPost[] = rows.map((r) => {
      const a = profMap.get(r.author_id);
      return {
        id: r.id,
        kind: r.kind,
        title: r.title,
        body: r.body,
        hashtags: r.hashtags,
        respect_count: r.respect_count,
        comment_count: r.comment_count,
        trainer_answered: r.trainer_answered,
        created_at: r.created_at,
        author: {
          user_id: r.author_id,
          username: a?.username ?? null,
          display_name: a?.display_name ?? null,
          avatar_url: a?.avatar_url ?? null,
          is_trainer: trainerSet.has(r.author_id),
        },
        top_reply: topReplyByPost.get(r.id) ?? null,
      };
    });

    return {
      items,
      total: res.count ?? items.length,
      page: data.page,
      pageSize: PAGE_SIZE,
    };
  });