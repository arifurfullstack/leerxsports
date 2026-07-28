import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createStorySchema = z
  .object({
    media_path: z.string().min(1),
    media_kind: z.enum(["image", "video"]),
    thumbnail_path: z.string().optional().nullable(),
    caption: z.string().max(240).optional().nullable(),
    duration_ms: z.number().int().min(1000).max(60_000).optional(),
  })
  .transform((val) => ({
    ...val,
    duration_ms: val.duration_ms ?? (val.media_kind === "video" ? 8000 : 5000),
  }));

export const createStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => createStorySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("stories")
      .insert({
        user_id: userId,
        media_url: data.media_path,
        media_kind: data.media_kind,
        thumbnail_url: data.thumbnail_path ?? null,
        caption: data.caption ?? null,
        duration_ms: data.duration_ms,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("stories")
      .select("id, user_id, media_url, thumbnail_url")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Story not found");
    if (row.user_id !== userId) throw new Error("Not your story");
    const paths = [row.media_url, row.thumbnail_url].filter(
      (p): p is string => !!p && !p.startsWith("http"),
    );
    if (paths.length) await supabase.storage.from("post-media").remove(paths);
    const { error: delErr } = await supabase.from("stories").delete().eq("id", data.id);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });

export type ActiveStorySlide = {
  id: string;
  media_url: string;
  media_kind: "image" | "video";
  thumbnail_url: string | null;
  caption: string | null;
  duration_ms: number;
  created_at: string;
  viewed: boolean;
  like_count: number;
  liked_by_me: boolean;
};

export type ActiveStoryReel = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  all_viewed: boolean;
  is_self: boolean;
  total_likes: number;
  slides: ActiveStorySlide[];
};

/**
 * Fetches all active (non-expired) stories, grouped by author, ordered so:
 * viewer's own reel first, then unseen reels newest-first, then seen reels.
 */
export const listActiveStories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ActiveStoryReel[]> => {
    const { supabase, userId } = context;

    const { data: rows, error } = await supabase
      .from("stories")
      .select(
        "id, user_id, media_url, media_kind, thumbnail_url, caption, duration_ms, created_at, like_count",
      )
      .gt("expires_at", new Date().toISOString())
      .eq("is_hidden", false)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const stories = rows ?? [];
    if (!stories.length) return [];

    const userIds = Array.from(new Set(stories.map((s) => s.user_id)));

    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, full_name, avatar_url")
      .in("user_id", userIds);
    const pmap = new Map(
      (profs ?? []).map((p) => [
        p.user_id,
        {
          username: p.username as string | null,
          display_name: (p.display_name ?? p.full_name) as string | null,
          avatar_url: p.avatar_url as string | null,
        },
      ]),
    );

    const { data: verified } = await supabase
      .from("trainer_profiles")
      .select("user_id")
      .in("user_id", userIds)
      .eq("is_verified", true);
    const verifiedSet = new Set((verified ?? []).map((r) => r.user_id));

    const storyIds = stories.map((s) => s.id);
    const { data: myViews } = await supabase
      .from("story_views")
      .select("story_id")
      .eq("viewer_id", userId)
      .in("story_id", storyIds);
    const viewed = new Set((myViews ?? []).map((v) => v.story_id));

    const { data: myLikes } = await supabase
      .from("story_likes")
      .select("story_id")
      .eq("user_id", userId)
      .in("story_id", storyIds);
    const liked = new Set((myLikes ?? []).map((v) => v.story_id));

    // Sign media/thumbnail URLs (post-media bucket is private).
    const paths = Array.from(
      new Set(
        stories
          .flatMap((s) => [s.media_url, s.thumbnail_url])
          .filter((p): p is string => !!p && !p.startsWith("http")),
      ),
    );
    const signedMap = new Map<string, string>();
    if (paths.length) {
      const { data: signed } = await supabase.storage
        .from("post-media")
        .createSignedUrls(paths, 60 * 60);
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) signedMap.set(s.path, s.signedUrl);
      }
    }

    const byUser = new Map<string, ActiveStorySlide[]>();
    for (const s of stories) {
      const arr = byUser.get(s.user_id) ?? [];
      arr.push({
        id: s.id,
        media_url: signedMap.get(s.media_url) ?? s.media_url,
        media_kind: s.media_kind as "image" | "video",
        thumbnail_url: s.thumbnail_url
          ? signedMap.get(s.thumbnail_url) ?? s.thumbnail_url
          : null,
        caption: s.caption,
        duration_ms: s.duration_ms ?? 5000,
        created_at: s.created_at,
        viewed: viewed.has(s.id),
        like_count: (s as { like_count?: number }).like_count ?? 0,
        liked_by_me: liked.has(s.id),
      });
      byUser.set(s.user_id, arr);
    }

    const reels: ActiveStoryReel[] = Array.from(byUser.entries()).map(([uid, slides]) => {
      const p = pmap.get(uid);
      return {
        user_id: uid,
        username: p?.username ?? null,
        display_name: p?.display_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        is_verified: verifiedSet.has(uid),
        is_self: uid === userId,
        all_viewed: slides.every((s) => s.viewed),
        total_likes: slides.reduce((sum, s) => sum + (s.like_count || 0), 0),
        slides,
      };
    });

    // Self first, then unseen (newest first), then seen (newest first)
    reels.sort((a, b) => {
      if (a.is_self && !b.is_self) return -1;
      if (b.is_self && !a.is_self) return 1;
      if (a.all_viewed !== b.all_viewed) return a.all_viewed ? 1 : -1;
      const aLast = a.slides[a.slides.length - 1]?.created_at ?? "";
      const bLast = b.slides[b.slides.length - 1]?.created_at ?? "";
      return bLast.localeCompare(aLast);
    });
    return reels;
  });

export const recordStoryView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ story_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("story_views")
      .insert({ story_id: data.story_id, viewer_id: userId });
    // Ignore unique-violation duplicates
    if (error && !/duplicate|unique/i.test(error.message)) {
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const toggleStoryLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z.object({ story_id: z.string().uuid(), like: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.like) {
      const { error } = await supabase
        .from("story_likes")
        .insert({ story_id: data.story_id, user_id: userId });
      if (error && !/duplicate|unique/i.test(error.message)) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await supabase
        .from("story_likes")
        .delete()
        .eq("story_id", data.story_id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
    const { data: row } = await supabase
      .from("stories")
      .select("like_count")
      .eq("id", data.story_id)
      .maybeSingle();
    return { ok: true, like_count: (row?.like_count as number | undefined) ?? 0, liked: data.like };
  });