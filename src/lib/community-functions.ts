import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type CommunityKind = "question" | "flex";
export type CommunitySort = "new" | "top" | "trending";

export type CommunityPost = {
  id: string;
  author_id: string;
  kind: CommunityKind;
  title: string;
  body: string;
  media: string[];
  hashtags: string[];
  respect_count: number;
  comment_count: number;
  trainer_answered: boolean;
  created_at: string;
  author: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_trainer: boolean;
  } | null;
};

export type CommunityComment = {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  author: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_trainer: boolean;
  } | null;
};

function publicClient() {
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

async function hydrateAuthors(
  supabase: ReturnType<typeof publicClient>,
  ids: string[],
): Promise<Map<string, CommunityPost["author"]>> {
  const map = new Map<string, CommunityPost["author"]>();
  if (ids.length === 0) return map;
  const uniq = Array.from(new Set(ids));
  const [{ data: profs }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .in("user_id", uniq),
    supabase.from("user_roles").select("user_id, role").in("user_id", uniq),
  ]);
  const trainerSet = new Set(
    (roles ?? []).filter((r) => r.role === "trainer").map((r) => r.user_id),
  );
  for (const p of profs ?? []) {
    map.set(p.user_id, {
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      is_trainer: trainerSet.has(p.user_id),
    });
  }
  return map;
}

export const listCommunityPosts = createServerFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        kind: z.enum(["question", "flex", "all"]).default("all"),
        sort: z.enum(["new", "top", "trending"]).default("new"),
        limit: z.number().int().min(1).max(60).default(30),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<CommunityPost[]> => {
    const supabase = publicClient();
    let q = supabase
      .from("community_posts")
      .select(
        "id, author_id, kind, title, body, media, hashtags, respect_count, comment_count, trainer_answered, created_at",
      )
      .eq("status", "visible");
    if (data.kind !== "all") q = q.eq("kind", data.kind);
    if (data.sort === "top") q = q.order("respect_count", { ascending: false });
    else q = q.order("created_at", { ascending: false });
    q = q.limit(data.limit);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const authors = await hydrateAuthors(
      supabase,
      (rows ?? []).map((r) => r.author_id),
    );

    let posts = (rows ?? []).map<CommunityPost>((r) => ({
      ...r,
      author: authors.get(r.author_id) ?? null,
    }));

    if (data.sort === "trending") {
      const now = Date.now();
      const halfLife = 24 * 60 * 60 * 1000;
      posts = posts
        .map((p) => {
          const age = now - new Date(p.created_at).getTime();
          const decay = Math.pow(0.5, age / halfLife);
          const score =
            (p.respect_count * 3 + p.comment_count * 2 + (p.trainer_answered ? 5 : 0)) *
            decay;
          return { p, score };
        })
        .sort((a, b) => b.score - a.score)
        .map((x) => x.p);
    }

    return posts;
  });

export const getCommunityPost = createServerFn({ method: "POST" })
  .validator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<{
    post: CommunityPost;
    comments: CommunityComment[];
  } | null> => {
    const supabase = publicClient();
    const { data: row, error } = await supabase
      .from("community_posts")
      .select(
        "id, author_id, kind, title, body, media, hashtags, respect_count, comment_count, trainer_answered, created_at",
      )
      .eq("id", data.id)
      .eq("status", "visible")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;

    const { data: comments, error: cErr } = await supabase
      .from("community_comments")
      .select("id, post_id, author_id, parent_id, body, created_at")
      .eq("post_id", data.id)
      .eq("status", "visible")
      .order("created_at", { ascending: true });
    if (cErr) throw new Error(cErr.message);

    const ids = [row.author_id, ...(comments ?? []).map((c) => c.author_id)];
    const authors = await hydrateAuthors(supabase, ids);

    return {
      post: { ...row, author: authors.get(row.author_id) ?? null },
      comments: (comments ?? []).map<CommunityComment>((c) => ({
        ...c,
        author: authors.get(c.author_id) ?? null,
      })),
    };
  });

const createPostInput = z.object({
  kind: z.enum(["question", "flex"]),
  title: z.string().trim().min(3).max(140),
  body: z.string().trim().max(4000).default(""),
  hashtags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  media: z.array(z.string().url()).max(6).default([]),
});

export const createCommunityPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => createPostInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("community_posts")
      .insert({
        author_id: userId,
        kind: data.kind,
        title: data.title,
        body: data.body,
        hashtags: data.hashtags,
        media: data.media,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteCommunityPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("community_posts")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleCommunityRespect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ postId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("community_respects")
      .select("id")
      .eq("post_id", data.postId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("community_respects")
        .delete()
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { respected: false };
    }
    const { error } = await supabase
      .from("community_respects")
      .insert({ post_id: data.postId, user_id: userId });
    if (error) throw new Error(error.message);
    return { respected: true };
  });

export const addCommunityComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        postId: z.string().uuid(),
        body: z.string().trim().min(1).max(2000),
        parentId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // PRD: Only post owner can reply to a trainer's top-level comment
    if (data.parentId) {
      const { data: parentComment, error: pcErr } = await supabase
        .from("community_comments")
        .select("id, author_id, parent_id")
        .eq("id", data.parentId)
        .maybeSingle();
      if (pcErr) throw new Error(pcErr.message);
      if (!parentComment) throw new Error("Parent comment not found.");

      // Check if parent is a top-level trainer comment
      if (!parentComment.parent_id) {
        const { data: authorRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", parentComment.author_id)
          .eq("role", "trainer")
          .maybeSingle();

        if (authorRole) {
          // Parent is a trainer's top-level comment — only post owner can reply
          const { data: postRow, error: postErr } = await supabase
            .from("community_posts")
            .select("author_id")
            .eq("id", data.postId)
            .single();
          if (postErr) throw new Error(postErr.message);
          if (postRow.author_id !== userId) {
            throw new Error(
              "Only the post author can reply to a trainer's comment."
            );
          }
        }
      }
    }

    const { data: row, error } = await supabase
      .from("community_comments")
      .insert({
        post_id: data.postId,
        author_id: userId,
        parent_id: data.parentId ?? null,
        body: data.body,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const getMyCommunityRespects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z.object({ postIds: z.array(z.string().uuid()).max(60) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<string[]> => {
    if (data.postIds.length === 0) return [];
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("community_respects")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", data.postIds);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => r.post_id);
  });
