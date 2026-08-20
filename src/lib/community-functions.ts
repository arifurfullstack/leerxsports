import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { sanitizeText } from "@/lib/text-moderation";

export type CommunityKind = "question" | "flex";
export type CommunitySort = "new" | "top" | "trending";

export type CoachingStatus = "pending" | "coached" | "coaching_completed";

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
  coaching_status: CoachingStatus | null;
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
  media_urls: string[];
  is_private: boolean;
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
        "id, author_id, kind, title, body, media, hashtags, respect_count, comment_count, trainer_answered, coaching_status, created_at",
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
      coaching_status: (r.coaching_status ?? null) as CoachingStatus | null,
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
  .validator((input) =>
    z
      .object({
        id: z.string().uuid(),
        callerId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{
    post: CommunityPost & { target_trainer_id: string | null };
    comments: CommunityComment[];
  } | null> => {
    const supabase = publicClient();
    const { data: row, error } = await supabase
      .from("community_posts")
      .select(
        "id, author_id, kind, title, body, media, hashtags, respect_count, comment_count, trainer_answered, coaching_status, created_at, target_trainer_id",
      )
      .eq("id", data.id)
      .eq("status", "visible")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;

    // Fetch all comments — we filter private ones below
    const { data: comments, error: cErr } = await supabase
      .from("community_comments")
      .select("id, post_id, author_id, parent_id, body, media_urls, is_private, created_at")
      .eq("post_id", data.id)
      .eq("status", "visible")
      .order("created_at", { ascending: true });
    if (cErr) throw new Error(cErr.message);

    // Private comments are visible only to: post author, target trainer, caller who is admin
    // We do a server-side filter based on callerId
    const callerId = data.callerId ?? null;
    const visibleComments = (comments ?? []).filter((c) => {
      if (!c.is_private) return true;
      if (!callerId) return false;
      return (
        callerId === row.author_id ||
        callerId === row.target_trainer_id ||
        callerId === c.author_id
      );
    });

    const ids = [row.author_id, ...visibleComments.map((c) => c.author_id)];
    const authors = await hydrateAuthors(supabase, ids);

    return {
      post: { ...row, coaching_status: (row.coaching_status ?? null) as CoachingStatus | null, author: authors.get(row.author_id) ?? null },
      comments: visibleComments.map<CommunityComment>((c) => ({
        ...c,
        media_urls: c.media_urls ?? [],
        is_private: c.is_private ?? false,
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
  targetTrainerId: z.string().uuid().optional(),
});

export const createCommunityPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => createPostInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.targetTrainerId) {
      // Enforce subscriber-only rule for targeted coaching questions
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("subscriber_id", userId)
        .eq("trainer_id", data.targetTrainerId)
        .eq("status", "active")
        .maybeSingle();

      if (!sub) {
        throw new Error("You must have an active subscription to this trainer to submit a question.");
      }
    }

    const cleanTitle = sanitizeText(data.title);
    const cleanBody = sanitizeText(data.body);

    const { data: row, error } = await supabase
      .from("community_posts")
      .insert({
        author_id: userId,
        kind: data.kind,
        title: cleanTitle,
        body: cleanBody,
        hashtags: data.hashtags,
        media: data.media,
        target_trainer_id: data.targetTrainerId ?? null,
        // Coaching threads start in PENDING state
        coaching_status: data.targetTrainerId ? "pending" : null,
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
        body: z.string().trim().min(1).max(4000),
        parentId: z.string().uuid().optional(),
        mediaUrls: z.array(z.string().url()).max(3).default([]),
        isPrivate: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // ── Fetch post ────────────────────────────────────────────────────────
    const { data: postRow, error: postErr } = await supabase
      .from("community_posts")
      .select("author_id, target_trainer_id, coaching_status")
      .eq("id", data.postId)
      .single();
    if (postErr) throw new Error(postErr.message);

    const isCoachingThread = !!postRow.target_trainer_id;
    const isTargetTrainer  = postRow.target_trainer_id === userId;
    const isPostOwner      = postRow.author_id === userId;
    const coachingStatus   = postRow.coaching_status as CoachingStatus | null;

    // ── Guard: rich-media only for trainer ───────────────────────────────
    if (data.isPrivate && !isTargetTrainer) {
      throw new Error("Only the coaching trainer can post a private response.");
    }
    if (data.mediaUrls.length > 0 && !isTargetTrainer) {
      throw new Error("Only the coaching trainer can attach video responses.");
    }

    // ── 8.3 Coaching Lifecycle enforcement ───────────────────────────────
    if (isCoachingThread) {
      // Step 5 guard — thread fully locked
      if (coachingStatus === "coaching_completed") {
        throw new Error(
          "This coaching thread is complete and locked. No further replies are allowed."
        );
      }

      if (isTargetTrainer) {
        // RBAC: Verify caller holds a verified trainer role, verified profile, and is not in pending/rejected application status
        const { data: verifiedTrainerRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "trainer")
          .maybeSingle();

        const { data: trainerProfile } = await supabase
          .from("trainer_profiles")
          .select("is_verified")
          .eq("user_id", userId)
          .maybeSingle();

        const { data: appStatus } = await supabase
          .from("trainer_applications")
          .select("status")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const isPendingOrRejected =
          appStatus?.status === "pending" ||
          appStatus?.status === "rejected" ||
          appStatus?.status === "resubmit";

        if (!verifiedTrainerRole || !trainerProfile?.is_verified || isPendingOrRejected) {
          throw new Error(
            "Only verified Pro Trainers can submit coaching answers. Your trainer application may still be pending approval or unverified."
          );
        }

        // Step 2: Trainer's first response (PENDING → COACHED)
        // Step 4: Trainer's final answer   (COACHED → COACHING_COMPLETED)
        if (coachingStatus === "pending") {
          // Will transition to COACHED below
        } else if (coachingStatus === "coached") {
          // Trainer can only give final answer AFTER the trainee has sent a follow-up
          const { count } = await supabase
            .from("community_comments")
            .select("id", { count: "exact", head: true })
            .eq("post_id", data.postId)
            .eq("author_id", postRow.author_id)
            .is("parent_id", null);

          if (!count || count === 0) {
            throw new Error(
              "Waiting for the trainee's follow-up question before you can provide the final answer."
            );
          }
          // Will transition to COACHING_COMPLETED below
        } else {
          throw new Error("Unexpected coaching status — cannot reply.");
        }
      } else if (isPostOwner) {
        // Step 3: Trainee's ONE follow-up reply (only allowed while COACHED)
        if (coachingStatus !== "coached") {
          throw new Error(
            "You can only send a follow-up after the trainer has provided their initial coaching."
          );
        }
        // Exactly one follow-up allowed
        const { count } = await supabase
          .from("community_comments")
          .select("id", { count: "exact", head: true })
          .eq("post_id", data.postId)
          .eq("author_id", userId)
          .is("parent_id", null);

        if (count && count > 0) {
          throw new Error(
            "You have already submitted your follow-up question. Only one follow-up is allowed per coaching thread."
          );
        }
      } else {
        throw new Error(
          "Only the subscriber and their trainer can comment on a coaching thread."
        );
      }
    } else {
      // ── Standard community thread reply-permission rules ─────────────
      if (data.parentId) {
        const { data: parentComment, error: pcErr } = await supabase
          .from("community_comments")
          .select("id, author_id, parent_id")
          .eq("id", data.parentId)
          .maybeSingle();
        if (pcErr) throw new Error(pcErr.message);
        if (!parentComment) throw new Error("Parent comment not found.");

        if (!parentComment.parent_id) {
          const { data: authorRole } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", parentComment.author_id)
            .eq("role", "trainer")
            .maybeSingle();

          if (authorRole) {
            const isCommentAuthor = parentComment.author_id === userId;
            const { data: adminRole } = await supabase.rpc("has_role", {
              _user_id: userId,
              _role: "admin",
            });
            const isAdmin = !!adminRole;
            if (!isPostOwner && !isCommentAuthor && !isAdmin) {
              throw new Error("Only the post author can reply to a trainer's comment.");
            }
          }
        }
      }
    }

    // ── Insert comment ────────────────────────────────────────────────────
    const cleanCommentBody = sanitizeText(data.body);

    const { data: inserted, error: insertErr } = await supabase
      .from("community_comments")
      .insert({
        post_id: data.postId,
        author_id: userId,
        parent_id: data.parentId ?? null,
        body: cleanCommentBody,
        media_urls: data.mediaUrls,
        is_private: data.isPrivate,
      })
      .select("id")
      .single();
    if (insertErr) throw new Error(insertErr.message);

    // ── Advance coaching lifecycle status ─────────────────────────────────
    if (isCoachingThread) {
      let nextStatus: CoachingStatus | null = null;

      if (isTargetTrainer && coachingStatus === "pending") {
        nextStatus = "coached"; // Step 2 complete
      } else if (isTargetTrainer && coachingStatus === "coached") {
        nextStatus = "coaching_completed"; // Step 4 → Step 5
      }
      // trainee follow-up keeps status as "coached"

      if (nextStatus) {
        await supabase
          .from("community_posts")
          .update({
            coaching_status: nextStatus,
            trainer_answered: true,
          })
          .eq("id", data.postId);
      }
    }

    return { id: inserted.id };
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
