import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createPostSchema = z.object({
  kind: z.enum(["feed", "short"]),
  is_premium: z.boolean(),
  caption: z.string().max(2000).optional().nullable(),
  media_path: z.string().min(1),
  thumbnail_path: z.string().optional().nullable(),
  duration_seconds: z.number().int().positive().optional().nullable(),
});

export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createPostSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Confirm trainer role
    const { data: isTrainer, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "trainer",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isTrainer) throw new Error("Only approved trainers can publish posts.");

    const { data: row, error } = await supabase
      .from("posts")
      .insert({
        trainer_id: userId,
        kind: data.kind,
        is_premium: data.is_premium,
        caption: data.caption ?? null,
        media_url: data.media_path,
        thumbnail_url: data.thumbnail_path ?? null,
        duration_seconds: data.duration_seconds ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error: fetchErr } = await supabase
      .from("posts")
      .select("id, trainer_id, media_url, thumbnail_url")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) throw new Error("Post not found.");
    if (row.trainer_id !== userId) throw new Error("Not your post.");

    const pathsToRemove = [row.media_url, row.thumbnail_url].filter(
      (p): p is string => !!p && !p.startsWith("http"),
    );
    if (pathsToRemove.length > 0) {
      await supabase.storage.from("post-media").remove(pathsToRemove);
    }
    const { error: delErr } = await supabase.from("posts").delete().eq("id", data.id);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });

export const listMyPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("posts")
      .select(
        "id, kind, is_premium, caption, media_url, thumbnail_url, duration_seconds, respect_count, save_count, view_count, is_published, created_at",
      )
      .eq("trainer_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Sign preview URLs for the trainer's own dashboard
    const rows = data ?? [];
    const paths = rows.flatMap((r) => [r.media_url, r.thumbnail_url]).filter(
      (p): p is string => !!p && !p.startsWith("http"),
    );
    const signedMap = new Map<string, string>();
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage
        .from("post-media")
        .createSignedUrls(Array.from(new Set(paths)), 60 * 60);
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) signedMap.set(s.path, s.signedUrl);
      }
    }

    return rows.map((r) => ({
      ...r,
      media_url: signedMap.get(r.media_url) ?? r.media_url,
      thumbnail_url: r.thumbnail_url
        ? signedMap.get(r.thumbnail_url) ?? r.thumbnail_url
        : null,
    }));
  });