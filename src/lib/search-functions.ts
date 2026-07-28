import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const searchSchema = z.object({
  q: z.string().max(200).optional(),
  country: z.string().max(80).optional(),
  language: z.string().max(20).optional(),
  specialty: z.string().max(80).optional(),
  verifiedOnly: z.boolean().optional(),
  coachingOnly: z.boolean().optional(),
  minPrice: z.number().min(0).max(10000).optional(),
  maxPrice: z.number().min(0).max(10000).optional(),
  sort: z.enum(["popularity", "newest", "price_asc", "price_desc"]).default("popularity"),
  limit: z.number().min(1).max(50).default(24),
});

export type TrainerHit = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
  bio: string | null;
  specialties: string[];
  subscription_price: number;
  is_verified: boolean;
  dms_enabled: boolean;
};

export type PostHit = {
  id: string;
  trainer_id: string;
  caption: string | null;
  media_url: string;
  thumbnail_url: string | null;
  is_premium: boolean;
  created_at: string;
};

export type CommunityHit = {
  id: string;
  author_id: string;
  title: string | null;
  body: string | null;
  created_at: string;
};

function buildClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const searchTrainers = createServerFn({ method: "POST" })
  .validator((input) => searchSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = buildClient();
    if (!supabase) return [];
    let q = supabase
      .from("trainer_profiles")
      .select(
        "user_id, subscription_price, is_verified, specialties, dms_enabled, profile:profiles!inner(user_id, username, display_name, avatar_url, country, bio, additional_languages, native_language)",
      )
      .limit(data.limit);

    if (data.verifiedOnly) q = q.eq("is_verified", true);
    if (typeof data.minPrice === "number") q = q.gte("subscription_price", data.minPrice);
    if (typeof data.maxPrice === "number") q = q.lte("subscription_price", data.maxPrice);
    if (data.specialty) q = q.contains("specialties", [data.specialty]);

    if (data.sort === "price_asc") q = q.order("subscription_price", { ascending: true });
    else if (data.sort === "price_desc") q = q.order("subscription_price", { ascending: false });
    else if (data.sort === "newest") q = q.order("created_at", { ascending: false });
    else q = q.order("is_verified", { ascending: false }).order("created_at", { ascending: false });

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    let hits: TrainerHit[] = (rows ?? []).map((r: any) => ({
      user_id: r.user_id,
      username: r.profile?.username ?? null,
      display_name: r.profile?.display_name ?? null,
      avatar_url: r.profile?.avatar_url ?? null,
      country: r.profile?.country ?? null,
      bio: r.profile?.bio ?? null,
      specialties: r.specialties ?? [],
      subscription_price: r.subscription_price,
      is_verified: r.is_verified,
      dms_enabled: r.dms_enabled ?? true,
      _langs: [r.profile?.native_language, ...(r.profile?.additional_languages ?? [])].filter(Boolean) as string[],
    })) as any;

    const query = data.q?.trim().toLowerCase();
    if (query) {
      hits = hits.filter((h) => {
        const hay = [h.username, h.display_name, h.bio, h.country, ...(h.specialties ?? [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(query);
      });
    }
    if (data.country) {
      const c = data.country.toLowerCase();
      hits = hits.filter((h) => (h.country ?? "").toLowerCase().includes(c));
    }
    if (data.language) {
      const l = data.language.toLowerCase();
      hits = hits.filter((h: any) => (h._langs ?? []).some((x: string) => x.toLowerCase().includes(l)));
    }
    return hits.map(({ ...rest }: any) => {
      const clone = { ...rest };
      delete clone._langs;
      return clone as TrainerHit;
    });
  });

export const searchPosts = createServerFn({ method: "POST" })
  .validator((input) => z.object({ q: z.string().min(1).max(200), limit: z.number().min(1).max(50).default(20) }).parse(input))
  .handler(async ({ data }) => {
    const supabase = buildClient();
    if (!supabase) return [];
    const { data: rows, error } = await supabase
      .from("posts")
      .select("id, trainer_id, caption, media_url, thumbnail_url, is_premium, created_at, is_hidden, is_published")
      .eq("is_published", true)
      .eq("is_premium", false)
      .eq("is_hidden", false)
      .ilike("caption", `%${data.q}%`)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      trainer_id: r.trainer_id,
      caption: r.caption,
      media_url: r.media_url,
      thumbnail_url: r.thumbnail_url,
      is_premium: r.is_premium,
      created_at: r.created_at,
    })) as PostHit[];
  });

export const searchCommunity = createServerFn({ method: "POST" })
  .validator((input) => z.object({ q: z.string().min(1).max(200), limit: z.number().min(1).max(50).default(20) }).parse(input))
  .handler(async ({ data }) => {
    const supabase = buildClient();
    if (!supabase) return [];
    const { data: rows, error } = await supabase
      .from("community_posts")
      .select("id, author_id, title, body, created_at, status")
      .eq("status", "visible")
      .or(`title.ilike.%${data.q}%,body.ilike.%${data.q}%`)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      author_id: r.author_id,
      title: r.title,
      body: r.body,
      created_at: r.created_at,
    })) as CommunityHit[];
  });