import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

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
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export type TransformationPost = {
  id: string;
  user_id: string;
  kind: "photo" | "video";
  media_url: string;
  thumbnail_url: string | null;
  view_angle: "front" | "side" | "back" | "other";
  captured_on: string;
  weight_kg: number | null;
  body_fat_percent: number | null;
  notes: string | null;
  visibility: "public" | "subscribers" | "private";
  created_at: string;
};

export type TraineeProfile = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  country: string | null;
  native_language: string | null;
  additional_languages: string[];
  goal: string | null;
  experience_level: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_fat_percent: number | null;
  skeletal_muscle_kg: number | null;
  gender: string | null;
  personal_records: string | null;
  social_links: string[];
  profile_visibility: "public" | "subscribers" | "private";
  transformation_visibility: "public" | "subscribers" | "private";
  is_verified: boolean;
  transformations: TransformationPost[];
};

async function signMediaPaths<T extends { media_url: string; thumbnail_url: string | null }>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rows: T[],
): Promise<T[]> {
  const paths = rows
    .flatMap((r) => [r.media_url, r.thumbnail_url])
    .filter((p): p is string => !!p && !p.startsWith("http"));
  if (!paths.length) return rows;
  const { data: signed } = await supabase.storage
    .from("post-media")
    .createSignedUrls(Array.from(new Set(paths)), 60 * 60);
  const map = new Map<string, string>();
  for (const s of signed ?? []) if (s.path && s.signedUrl) map.set(s.path, s.signedUrl);
  return rows.map((r) => ({
    ...r,
    media_url: map.get(r.media_url) ?? r.media_url,
    thumbnail_url: r.thumbnail_url ? map.get(r.thumbnail_url) ?? r.thumbnail_url : null,
  }));
}

// -------- Public trainee profile fetch (only public data) --------
export const getTraineeProfile = createServerFn({ method: "GET" })
  .validator((input) => z.object({ username: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const supabase = getPublicSupabase();

    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "user_id, username, display_name, avatar_url, cover_url, bio, country, native_language, additional_languages, goal, experience_level, height_cm, weight_kg, body_fat_percent, skeletal_muscle_kg, gender, personal_records, social_links, profile_visibility, transformation_visibility, is_verified",
      )
      .ilike("username", data.username)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("Profile not found.");
    if (profile.profile_visibility === "private") {
      throw new Error("This profile is private.");
    }

    let transformations: TransformationPost[] = [];
    if (profile.transformation_visibility === "public") {
      const { data: rows, error: tErr } = await supabase
        .from("transformation_posts")
        .select(
          "id, user_id, kind, media_url, thumbnail_url, view_angle, captured_on, weight_kg, body_fat_percent, notes, visibility, created_at",
        )
        .eq("user_id", profile.user_id)
        .eq("visibility", "public")
        .order("captured_on", { ascending: false });
      if (tErr) throw new Error(tErr.message);
      transformations = (await signMediaPaths(
        supabase,
        (rows ?? []) as TransformationPost[],
      )) as TransformationPost[];
    }

    return {
      ...(profile as Omit<TraineeProfile, "transformations">),
      transformations,
    } as TraineeProfile;
  });

export type TraineeFeedPost = {
  id: string;
  trainer_id: string;
  kind: "feed" | "short";
  is_premium: boolean;
  caption: string | null;
  media_url: string;
  thumbnail_url: string | null;
  respect_count: number;
  comment_count: number;
  created_at: string;
};

export const getTraineePosts = createServerFn({ method: "GET" })
  .validator((input) => z.object({ userId: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const supabase = getPublicSupabase();
    const { data: rows, error } = await supabase
      .from("posts")
      .select(
        "id, trainer_id, kind, is_premium, caption, media_url, thumbnail_url, respect_count, comment_count, created_at",
      )
      .eq("trainer_id", data.userId)
      .order("created_at", { ascending: false });
    if (error) return [];
    const raw = (rows ?? []) as TraineeFeedPost[];
    if (raw.length === 0) return [];

    const postIds = raw.map((p) => p.id);
    const { data: commentRows } = await supabase
      .from("comments")
      .select("post_id")
      .in("post_id", postIds)
      .eq("status", "visible");

    const commentCountMap = new Map<string, number>();
    if (commentRows) {
      for (const r of commentRows) {
        commentCountMap.set(r.post_id, (commentCountMap.get(r.post_id) ?? 0) + 1);
      }
    }

    const signed = await signMediaPaths(
      supabase,
      raw.map((p) => ({
        ...p,
        media_url: p.media_url || "",
        thumbnail_url: p.thumbnail_url,
      })),
    );
    return raw.map((p, i) => ({
      ...p,
      comment_count: commentCountMap.has(p.id) ? commentCountMap.get(p.id)! : p.comment_count,
      media_url: signed[i]?.media_url || p.media_url,
      thumbnail_url: signed[i]?.thumbnail_url || p.thumbnail_url,
    }));
  });

// -------- Owner: list all own transformations (any visibility) --------
export const listMyTransformations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("transformation_posts")
      .select(
        "id, user_id, kind, media_url, thumbnail_url, view_angle, captured_on, weight_kg, body_fat_percent, notes, visibility, created_at",
      )
      .eq("user_id", userId)
      .order("captured_on", { ascending: false });
    if (error) throw new Error(error.message);
    return (await signMediaPaths(
      supabase,
      (data ?? []) as TransformationPost[],
    )) as TransformationPost[];
  });

// -------- Create --------
const createSchema = z.object({
  kind: z.enum(["photo", "video"]),
  media_path: z.string().min(1),
  thumbnail_path: z.string().optional().nullable(),
  view_angle: z.enum(["front", "side", "back", "other"]),
  captured_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD required"),
  weight_kg: z.coerce.number().positive().max(500).optional().nullable(),
  body_fat_percent: z.coerce.number().min(1).max(70).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  visibility: z.enum(["public", "subscribers", "private"]).default("public"),
});

export const createTransformation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("transformation_posts")
      .insert({
        user_id: userId,
        kind: data.kind,
        media_url: data.media_path,
        thumbnail_url: data.thumbnail_path ?? null,
        view_angle: data.view_angle,
        captured_on: data.captured_on,
        weight_kg: data.weight_kg ?? null,
        body_fat_percent: data.body_fat_percent ?? null,
        notes: data.notes ?? null,
        visibility: data.visibility,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteTransformation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error: fErr } = await supabase
      .from("transformation_posts")
      .select("id, user_id, media_url, thumbnail_url")
      .eq("id", data.id)
      .maybeSingle();
    if (fErr) throw new Error(fErr.message);
    if (!row) throw new Error("Not found.");
    if (row.user_id !== userId) throw new Error("Not your post.");

    const paths = [row.media_url, row.thumbnail_url].filter(
      (p): p is string => !!p && !p.startsWith("http"),
    );
    if (paths.length) await supabase.storage.from("post-media").remove(paths);

    const { error: dErr } = await supabase.from("transformation_posts").delete().eq("id", data.id);
    if (dErr) throw new Error(dErr.message);
    return { ok: true };
  });

// -------- Update trainee profile settings (visibility + PRs + stats) --------
const updateProfileSchema = z.object({
  display_name: z.string().trim().min(1, "Name is required").max(80).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  goal: z.string().max(200).optional().nullable(),
  personal_records: z.string().max(2000).optional().nullable(),
  height_cm: z.coerce.number().positive().max(300).optional().nullable(),
  weight_kg: z.coerce.number().positive().max(500).optional().nullable(),
  body_fat_percent: z.coerce.number().min(1).max(70).optional().nullable(),
  skeletal_muscle_kg: z.coerce.number().positive().max(200).optional().nullable(),
  social_links: z
    .array(z.string().trim().url("Enter a valid URL").max(300))
    .max(10, "Maximum 10 links")
    .optional(),
  profile_visibility: z.enum(["public", "subscribers", "private"]).optional(),
  transformation_visibility: z.enum(["public", "subscribers", "private"]).optional(),
});

export const updateTraineeProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => updateProfileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("profiles").update(data).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });