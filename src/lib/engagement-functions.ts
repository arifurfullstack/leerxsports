import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { QueryClient } from "@tanstack/react-query";

export type PostEngagement = {
  respect: boolean;
  save: boolean;
  counts: {
    respect_count: number;
    save_count: number;
    comment_count: number;
    share_count: number;
  };
};

export function syncGlobalPostCounts(
  qc: QueryClient,
  postId: string,
  deltas: { commentDelta?: number; respectDelta?: number; saveDelta?: number },
) {
  const patch = (old: any) => {
    if (!old) return old;
    if (Array.isArray(old)) {
      return old.map((p) => {
        if (p && typeof p === "object" && "id" in p && p.id === postId) {
          return {
            ...p,
            comment_count: Math.max(0, (p.comment_count ?? 0) + (deltas.commentDelta ?? 0)),
            respect_count: Math.max(0, (p.respect_count ?? 0) + (deltas.respectDelta ?? 0)),
            save_count: Math.max(0, (p.save_count ?? 0) + (deltas.saveDelta ?? 0)),
          };
        }
        return p;
      });
    }
    return old;
  };

  qc.setQueriesData({}, patch);
}

export const getPostEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ postId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<PostEngagement> => {
    const { supabase, userId } = context;
    const [postRes, respectCountRes, respectRes, saveCountRes, saveRes, commentCountRes, shareCountRes] = await Promise.all([
      supabase
        .from("posts")
        .select("respect_count, save_count, comment_count")
        .eq("id", data.postId)
        .maybeSingle(),
      supabase
        .from("respects")
        .select("id", { count: "exact", head: true })
        .eq("post_id", data.postId),
      supabase
        .from("respects")
        .select("id")
        .eq("user_id", userId)
        .eq("post_id", data.postId)
        .maybeSingle(),
      supabase
        .from("saves")
        .select("id", { count: "exact", head: true })
        .eq("post_id", data.postId),
      supabase
        .from("saves")
        .select("id")
        .eq("user_id", userId)
        .eq("post_id", data.postId)
        .maybeSingle(),
      supabase
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("post_id", data.postId)
        .eq("status", "visible"),
      supabase
        .from("shares")
        .select("id", { count: "exact", head: true })
        .eq("post_id", data.postId),
    ]);
    if (postRes.error) throw new Error(postRes.error.message);
    const realRespects = respectCountRes.count !== null && respectCountRes.count !== undefined ? respectCountRes.count : (postRes.data?.respect_count ?? 0);
    const realSaves = saveCountRes.count !== null && saveCountRes.count !== undefined ? saveCountRes.count : (postRes.data?.save_count ?? 0);
    const realComments = commentCountRes.count !== null && commentCountRes.count !== undefined ? commentCountRes.count : (postRes.data?.comment_count ?? 0);

    return {
      respect: !!respectRes.data,
      save: !!saveRes.data,
      counts: {
        respect_count: realRespects,
        save_count: realSaves,
        comment_count: realComments,
        share_count: shareCountRes.count ?? 0,
      },
    };
  });

export const toggleRespect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ postId: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("respects")
      .select("id")
      .eq("user_id", userId)
      .eq("post_id", data.postId)
      .maybeSingle();
    let isRespect = false;
    if (existing) {
      const { error } = await supabase.from("respects").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
      isRespect = false;
    } else {
      const { error } = await supabase
        .from("respects")
        .insert({ user_id: userId, post_id: data.postId });
      if (error) throw new Error(error.message);
      isRespect = true;
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { count } = await supabaseAdmin
        .from("respects")
        .select("id", { count: "exact", head: true })
        .eq("post_id", data.postId);
      if (count !== null) {
        await supabaseAdmin.from("posts").update({ respect_count: count }).eq("id", data.postId);
      }
    } catch {
      /* ignore background update err */
    }

    return { respect: isRespect };
  });

export const toggleSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ postId: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("saves")
      .select("id")
      .eq("user_id", userId)
      .eq("post_id", data.postId)
      .maybeSingle();
    let isSave = false;
    if (existing) {
      const { error } = await supabase.from("saves").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
      isSave = false;
    } else {
      const { error } = await supabase
        .from("saves")
        .insert({ user_id: userId, post_id: data.postId });
      if (error) throw new Error(error.message);
      isSave = true;
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { count } = await supabaseAdmin
        .from("saves")
        .select("id", { count: "exact", head: true })
        .eq("post_id", data.postId);
      if (count !== null) {
        await supabaseAdmin.from("posts").update({ save_count: count }).eq("id", data.postId);
      }
    } catch {
      /* ignore background update err */
    }

    return { save: isSave };
  });

export const logShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        postId: z.string().min(1),
        channel: z.string().trim().max(40).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("shares").insert({
      user_id: userId,
      post_id: data.postId,
      channel: data.channel ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const logPostView = createServerFn({ method: "POST" })
  .validator((input) => z.object({ postId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Best-effort atomic increment via RPC; fallback to read-modify-write.
    const rpc = await supabaseAdmin.rpc("increment_post_view", {
      p_post_id: data.postId,
    });
    if (rpc.error) {
      const { data: row } = await supabaseAdmin
        .from("posts")
        .select("view_count")
        .eq("id", data.postId)
        .maybeSingle();
      const next = (row?.view_count ?? 0) + 1;
      await supabaseAdmin
        .from("posts")
        .update({ view_count: next })
        .eq("id", data.postId);
    }
    return { ok: true };
  });

export type ViewerEngagementBatch = {
  liked: string[];
  saved: string[];
};

export const getViewerEngagementBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z.object({ postIds: z.array(z.string().uuid()).max(200) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ViewerEngagementBatch> => {
    const { supabase, userId } = context;
    if (data.postIds.length === 0) return { liked: [], saved: [] };
    const [respectRes, saveRes] = await Promise.all([
      supabase
        .from("respects")
        .select("post_id")
        .eq("user_id", userId)
        .in("post_id", data.postIds),
      supabase
        .from("saves")
        .select("post_id")
        .eq("user_id", userId)
        .in("post_id", data.postIds),
    ]);
    return {
      liked: (respectRes.data ?? []).map((r) => r.post_id as string),
      saved: (saveRes.data ?? []).map((r) => r.post_id as string),
    };
  });

export type CommentNode = {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  status: "visible" | "hidden" | "deleted";
  created_at: string;
  author: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
};

export const listComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ postId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<CommentNode[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("comments")
      .select(
        "id, post_id, author_id, parent_id, body, status, created_at",
      )
      .eq("post_id", data.postId)
      .eq("status", "visible")
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    const authorIds = Array.from(new Set((rows ?? []).map((r) => r.author_id)));
    if (authorIds.length === 0) return [];
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .in("user_id", authorIds);
    if (pErr) throw new Error(pErr.message);
    const pmap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    return (rows ?? []).map((r) => ({
      id: r.id,
      post_id: r.post_id,
      author_id: r.author_id,
      parent_id: r.parent_id,
      body: r.body,
      status: r.status as CommentNode["status"],
      created_at: r.created_at,
      author: {
        username: pmap.get(r.author_id)?.username ?? null,
        display_name: pmap.get(r.author_id)?.display_name ?? null,
        avatar_url: pmap.get(r.author_id)?.avatar_url ?? null,
      },
    }));
  });

export type CommentsPage = {
  comments: CommentNode[];
  nextCursor: string | null;
  totalRoots: number;
};

export const listCommentsPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        postId: z.string().uuid(),
        cursor: z.string().datetime().nullable().optional(),
        limit: z.number().int().min(1).max(50).optional(),
        sort: z.enum(["newest", "oldest"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<CommentsPage> => {
    const { supabase } = context;
    const limit = data.limit ?? 15;
    const sort = data.sort ?? "newest";
    const ascending = sort === "oldest";

    // Total root count (for header display)
    const { count: totalRoots } = await supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("post_id", data.postId)
      .eq("status", "visible")
      .is("parent_id", null);

    // Fetch a page of root comments in the requested order
    let rootQ = supabase
      .from("comments")
      .select("id, post_id, author_id, parent_id, body, status, created_at")
      .eq("post_id", data.postId)
      .eq("status", "visible")
      .is("parent_id", null)
      .order("created_at", { ascending })
      .limit(limit + 1);
    if (data.cursor) {
      rootQ = ascending
        ? rootQ.gt("created_at", data.cursor)
        : rootQ.lt("created_at", data.cursor);
    }
    const { data: roots, error: rootErr } = await rootQ;
    if (rootErr) throw new Error(rootErr.message);

    const hasMore = (roots?.length ?? 0) > limit;
    const pageRoots = (roots ?? []).slice(0, limit);
    const nextCursor = hasMore
      ? pageRoots[pageRoots.length - 1]?.created_at ?? null
      : null;

    // Fetch replies for these roots
    const rootIds = pageRoots.map((r) => r.id);
    let replies: typeof pageRoots = [];
    if (rootIds.length > 0) {
      const { data: repRows, error: repErr } = await supabase
        .from("comments")
        .select("id, post_id, author_id, parent_id, body, status, created_at")
        .eq("post_id", data.postId)
        .eq("status", "visible")
        .in("parent_id", rootIds)
        .order("created_at", { ascending: true });
      if (repErr) throw new Error(repErr.message);
      replies = repRows ?? [];
    }

    const all = [...pageRoots, ...replies];
    const authorIds = Array.from(new Set(all.map((r) => r.author_id)));
    const pmap = new Map<
      string,
      { username: string | null; display_name: string | null; avatar_url: string | null }
    >();
    if (authorIds.length > 0) {
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", authorIds);
      if (pErr) throw new Error(pErr.message);
      for (const p of profiles ?? []) pmap.set(p.user_id, p);
    }

    const toNode = (r: (typeof all)[number]): CommentNode => ({
      id: r.id,
      post_id: r.post_id,
      author_id: r.author_id,
      parent_id: r.parent_id,
      body: r.body,
      status: r.status as CommentNode["status"],
      created_at: r.created_at,
      author: {
        username: pmap.get(r.author_id)?.username ?? null,
        display_name: pmap.get(r.author_id)?.display_name ?? null,
        avatar_url: pmap.get(r.author_id)?.avatar_url ?? null,
      },
    });

    return {
      comments: [...pageRoots.map(toNode), ...replies.map(toNode)],
      nextCursor,
      totalRoots: totalRoots ?? 0,
    };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        postId: z.string().min(1),
        parentId: z.string().min(1).nullable().optional(),
        body: z.string().trim().min(1).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("comments")
      .insert({
        post_id: data.postId,
        parent_id: data.parentId ?? null,
        author_id: userId,
        body: data.body,
      })
      .select("id, post_id, author_id, parent_id, body, status, created_at")
      .single();
    if (error) throw new Error(error.message);
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("user_id", userId)
      .maybeSingle();
    const node: CommentNode = {
      id: row.id,
      post_id: row.post_id,
      author_id: row.author_id,
      parent_id: row.parent_id,
      body: row.body,
      status: row.status as CommentNode["status"],
      created_at: row.created_at,
      author: {
        username: profile?.username ?? null,
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
      },
    };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { count } = await supabaseAdmin
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("post_id", data.postId)
        .eq("status", "visible");
      if (count !== null) {
        await supabaseAdmin.from("posts").update({ comment_count: count }).eq("id", data.postId);
      }
    } catch {
      /* ignore background update err */
    }

    return node;
  });

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ commentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: target } = await supabase
      .from("comments")
      .select("post_id")
      .eq("id", data.commentId)
      .maybeSingle();

    // Author-only soft delete; RLS also enforces it.
    const { error } = await supabase
      .from("comments")
      .update({ status: "deleted" })
      .eq("id", data.commentId)
      .eq("author_id", userId);
    if (error) throw new Error(error.message);

    if (target?.post_id) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { count } = await supabaseAdmin
          .from("comments")
          .select("id", { count: "exact", head: true })
          .eq("post_id", target.post_id)
          .eq("status", "visible");
        if (count !== null) {
          await supabaseAdmin.from("posts").update({ comment_count: count }).eq("id", target.post_id);
        }
      } catch {
        /* ignore background update err */
      }
    }

    return { ok: true };
  });