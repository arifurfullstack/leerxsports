import { useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  BadgeCheck,
  Heart,
  Bookmark,
  MessageCircle,
  Share2,
  Lock,
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LazyImage } from "@/components/ui/lazy-image";
import type { Post } from "@/lib/trainer-functions";
import { TranslateToggle } from "./translate-toggle";
import {
  addComment,
  deleteComment,
  getPostEngagement,
  listCommentsPage,
  logShare,
  syncGlobalPostCounts,
  toggleRespect,
  toggleSave,
  type CommentNode,
  type PostEngagement,
} from "@/lib/engagement-functions";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ShareSheet, type ShareChannel } from "@/components/share-sheet";
import { VideoPlayer } from "@/components/video-player";

type PendingCommentNode = CommentNode & { pending?: boolean };

export function PostDetailDialog({
  post,
  open,
  onOpenChange,
  unlockedUrl,
  currentUserId,
  isSignedIn,
  onPrev,
  onNext,
  onCloseAutoFocus,
  panel = "media",
  onPanelChange,
  commentSort = "newest",
  onCommentSortChange,
}: {
  post: Post;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  unlockedUrl?: string | null;
  currentUserId: string | null;
  isSignedIn: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onCloseAutoFocus?: (event: Event) => void;
  panel?: "media" | "comments";
  onPanelChange?: (next: "media" | "comments") => void;
  commentSort?: "newest" | "oldest";
  onCommentSortChange?: (next: "newest" | "oldest") => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isSelf = !!currentUserId && post?.trainer_id === currentUserId;
  const locked = (post?.is_premium ?? false) && !unlockedUrl && !isSelf && !post?.media_url;

  const mediaSrc = post?.is_premium
    ? (unlockedUrl || post?.media_url || "")
    : (post?.media_url || "");
  const isVideo =
    post?.kind === "short" ||
    /\.(mp4|webm|mov)(\?|$)/i.test(mediaSrc);

  const getEng = useServerFn(getPostEngagement);
  const listPage = useServerFn(listCommentsPage);
  const respectFn = useServerFn(toggleRespect);
  const saveFn = useServerFn(toggleSave);
  const shareFn = useServerFn(logShare);
  const addFn = useServerFn(addComment);
  const delFn = useServerFn(deleteComment);

  const engQ = useQuery({
    queryKey: ["post-engagement", post?.id],
    queryFn: () => getEng({ data: { postId: post.id } }),
    enabled: isSignedIn && open && !!post,
  });
  const commentsQ = useInfiniteQuery({
    queryKey: ["post-comments", post?.id, commentSort],
    queryFn: ({ pageParam }) =>
      listPage({
        data: {
          postId: post.id,
          cursor: pageParam,
          limit: 15,
          sort: commentSort,
        },
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: isSignedIn && open && !locked && !!post,
  });

  const allComments = useMemo<PendingCommentNode[]>(
    () => (commentsQ.data?.pages ?? []).flatMap((p) => p.comments),
    [commentsQ.data],
  );

  // Count realtime-inserted comments from other users that arrive while the
  // viewer isn't at the edge of the list. Rendered as a floating pill.
  const [newCommentsCount, setNewCommentsCount] = useState(0);
  useEffect(() => {
    // Reset when switching post or closing panel.
    setNewCommentsCount(0);
  }, [post.id, panel, commentSort]);

  // Realtime: stream new/updated/deleted comments for this post
  useEffect(() => {
    if (!open || locked) return;
    const channel = supabase
      .channel(`post-comments-${post.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${post.id}`,
        },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
          qc.invalidateQueries({ queryKey: ["post-engagement", post.id] });
          if (payload.eventType === "INSERT") {
            const row = payload.new as { author_id?: string } | null;
            if (row?.author_id && row.author_id !== currentUserId) {
              setNewCommentsCount((n) => n + 1);
            }
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, locked, post.id, qc, currentUserId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (t && t.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft" && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight" && onNext) {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onPrev, onNext]);

  const engKey = ["post-engagement", post.id] as const;
  const commentsKey = ["post-comments", post.id, commentSort] as const;
  const applyEng = (patch: (prev: PostEngagement) => PostEngagement) => {
    qc.setQueryData<PostEngagement>(engKey, (prev) => {
      const base: PostEngagement =
        prev ?? {
          respect: false,
          save: false,
          counts: {
            respect_count: post.respect_count,
            save_count: post.save_count,
            comment_count: 0,
    share_count: 0,
          },
        };
      return patch(base);
    });
  };
  const invalidateFeeds = () => {
    qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
    qc.invalidateQueries({ queryKey: engKey });
    qc.invalidateQueries({ queryKey: ["home"] });
    qc.invalidateQueries({ queryKey: ["shorts-feed"] });
    qc.invalidateQueries({ queryKey: ["explore-feed"] });
    qc.invalidateQueries({ queryKey: ["feed"] });
    qc.invalidateQueries({ queryKey: ["trainee-posts"] });
  };

  const respectMut = useMutation({
    mutationFn: () => respectFn({ data: { postId: post.id } }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: engKey });
      const previous = qc.getQueryData<PostEngagement>(engKey);
      const isRespecting = !previous?.respect;
      applyEng((p) => ({
        ...p,
        respect: !p.respect,
        counts: {
          ...p.counts,
          respect_count: Math.max(0, p.counts.respect_count + (p.respect ? -1 : 1)),
        },
      }));
      syncGlobalPostCounts(qc, post.id, { respectDelta: isRespecting ? 1 : -1 });
      return { previous, isRespecting };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(engKey, ctx.previous);
      if (ctx) syncGlobalPostCounts(qc, post.id, { respectDelta: ctx.isRespecting ? -1 : 1 });
      toast.error(e.message);
    },
    onSettled: () => invalidateFeeds(),
  });

  type CommentsPageShape = {
    comments: PendingCommentNode[];
    nextCursor: string | null;
    totalRoots: number;
  };
  type CommentsInfinite = {
    pages: CommentsPageShape[];
    pageParams: Array<string | null>;
  };

  const addMut = useMutation({
    mutationFn: (body: string) => addFn({ data: { postId: post.id, body } }),
    onMutate: async (body: string) => {
      await qc.cancelQueries({ queryKey: ["post-comments", post.id] });
      const prevPages = qc.getQueryData<CommentsInfinite>(commentsKey);
      const prevEng = qc.getQueryData<PostEngagement>(engKey);

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const me = qc.getQueryData<{
        user_id: string;
        username: string | null;
        display_name: string | null;
        avatar_url: string | null;
      } | null>(["navbar-user"]);
      const temp: PendingCommentNode = {
        id: tempId,
        post_id: post.id,
        author_id: currentUserId ?? "",
        parent_id: null,
        body,
        status: "visible",
        created_at: new Date().toISOString(),
        author: {
          username: me?.username ?? null,
          display_name: me?.display_name ?? "You",
          avatar_url: me?.avatar_url ?? null,
        },
        pending: true,
      };

      qc.setQueryData<CommentsInfinite>(commentsKey, (old) => {
        if (!old || old.pages.length === 0) {
          return {
            pages: [{ comments: [temp], nextCursor: null, totalRoots: 1 }],
            pageParams: [null],
          };
        }
        const pages = old.pages.map((p, i) => {
          if (commentSort === "newest" && i === 0) {
            return {
              ...p,
              comments: [temp, ...p.comments],
              totalRoots: p.totalRoots + 1,
            };
          }
          if (commentSort === "oldest" && i === old.pages.length - 1 && !p.nextCursor) {
            return {
              ...p,
              comments: [...p.comments, temp],
              totalRoots: p.totalRoots + 1,
            };
          }
          return { ...p, totalRoots: p.totalRoots + 1 };
        });
        return { ...old, pages };
      });

      applyEng((p) => ({
        ...p,
        counts: { ...p.counts, comment_count: p.counts.comment_count + 1 },
      }));

      return { prevPages, prevEng, tempId };
    },
    onSuccess: (real, _body, ctx) => {
      if (!ctx?.tempId) return;
      qc.setQueryData<CommentsInfinite>(commentsKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            comments: p.comments.map((c) =>
              c.id === ctx.tempId ? { ...real, pending: false } : c,
            ),
          })),
        };
      });
    },
    onError: (err: Error, _body, ctx) => {
      if (ctx?.prevPages !== undefined) qc.setQueryData(commentsKey, ctx.prevPages);
      if (ctx?.prevEng !== undefined) qc.setQueryData(engKey, ctx.prevEng);
      toast.error(err.message || "Failed to post comment.");
    },
    onSettled: () => invalidateFeeds(),
  });

  const delMut = useMutation({
    mutationFn: (commentId: string) => delFn({ data: { commentId } }),
    onMutate: async (commentId: string) => {
      await qc.cancelQueries({ queryKey: ["post-comments", post.id] });
      const prevPages = qc.getQueryData<CommentsInfinite>(commentsKey);
      const prevEng = qc.getQueryData<PostEngagement>(engKey);
      let removedRoot = false;
      qc.setQueryData<CommentsInfinite>(commentsKey, (old) => {
        if (!old) return old;
        const pages = old.pages.map((p) => {
          const target = p.comments.find((c) => c.id === commentId);
          if (target && target.parent_id === null) removedRoot = true;
          return {
            ...p,
            comments: p.comments.filter((c) => c.id !== commentId && c.parent_id !== commentId),
            totalRoots: removedRoot ? Math.max(0, p.totalRoots - 1) : p.totalRoots,
          };
        });
        return { ...old, pages };
      });
      applyEng((p) => ({
        ...p,
        counts: {
          ...p.counts,
          comment_count: Math.max(0, p.counts.comment_count - 1),
        },
      }));
      syncGlobalPostCounts(qc, post.id, { commentDelta: -1 });
      return { prevPages, prevEng };
    },
    onError: (err: Error, _id, ctx) => {
      if (ctx?.prevPages !== undefined) qc.setQueryData(commentsKey, ctx.prevPages);
      if (ctx?.prevEng !== undefined) qc.setQueryData(engKey, ctx.prevEng);
      syncGlobalPostCounts(qc, post.id, { commentDelta: +1 });
      toast.error(err.message || "Failed to delete comment.");
    },
    onSettled: () => invalidateFeeds(),
  });
  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { postId: post.id } }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: engKey });
      const previous = qc.getQueryData<PostEngagement>(engKey);
      const isSaving = !previous?.save;
      applyEng((p) => ({
        ...p,
        save: !p.save,
        counts: {
          ...p.counts,
          save_count: Math.max(0, p.counts.save_count + (p.save ? -1 : 1)),
        },
      }));
      syncGlobalPostCounts(qc, post.id, { saveDelta: isSaving ? 1 : -1 });
      return { previous, isSaving };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(engKey, ctx.previous);
      if (ctx) syncGlobalPostCounts(qc, post.id, { saveDelta: ctx.isSaving ? -1 : 1 });
      toast.error(e.message);
    },
    onSettled: () => invalidateFeeds(),
  });

  const requireAuth = (cb: () => void) => {
    if (!isSignedIn) {
      import("@/lib/auth-gate").then((m) =>
        m.openAuthGate({ action: "interact with this post" }),
      );
      return;
    }
    cb();
  };

  const [shareOpen, setShareOpen] = useState(false);
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/posts/${post.id}`
      : `/posts/${post.id}`;
  const handleShared = async (channel: ShareChannel) => {
    const previous = qc.getQueryData<PostEngagement>(engKey);
    applyEng((p) => ({
      ...p,
      counts: { ...p.counts, share_count: p.counts.share_count + 1 },
    }));
    if (isSignedIn) {
      try {
        await shareFn({ data: { postId: post.id, channel } });
        qc.invalidateQueries({ queryKey: engKey });
      } catch {
        if (previous) qc.setQueryData(engKey, previous);
      }
    }
  };

  const totalCommentsCount =
    commentsQ.data?.pages?.[0]?.totalRoots ??
    (allComments.length > 0 ? allComments.length : (engQ.data?.counts.comment_count ?? post?.comment_count ?? 0));

  const counts = {
    respect_count: engQ.data?.counts.respect_count ?? post?.respect_count ?? 0,
    save_count: engQ.data?.counts.save_count ?? post?.save_count ?? 0,
    comment_count: totalCommentsCount,
    share_count: engQ.data?.counts.share_count ?? 0,
  };

  if (!post || !open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl overflow-hidden p-0 sm:max-h-[90vh]"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{post.caption ?? "Post"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-0 sm:grid-cols-[1.2fr_1fr]">
          {/* Mobile tab switcher — restores active panel per post via URL */}
          <div
            role="tablist"
            aria-label="Post sections"
            className="col-span-full flex items-center gap-1 border-b border-border p-2 sm:hidden"
          >
            <TabBtn
              active={panel === "media"}
              onClick={() => onPanelChange?.("media")}
              label="Media"
            />
            <TabBtn
              active={panel === "comments"}
              onClick={() => onPanelChange?.("comments")}
              label="Comments"
            />
          </div>
          {/* Media */}
          <div
            className={cn(
              "relative flex aspect-square items-center justify-center bg-black sm:aspect-auto",
              panel === "comments" ? "hidden sm:flex" : "flex",
            )}
            role="tabpanel"
            aria-label="Media"
          >
            {locked ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <Lock className="h-8 w-8 text-primary" />
                <p className="font-display uppercase tracking-widest text-primary">
                  Premium
                </p>
                <p className="text-sm text-muted-foreground">
                  Subscribe to unlock this post.
                </p>
              </div>
            ) : isVideo && mediaSrc ? (
              <VideoPlayer
                src={mediaSrc}
                poster={post.thumbnail_url ?? undefined}
                title={post.caption ?? "Post video"}
                aspectRatio="16/9"
                className="max-h-[70vh] w-full"
              />
            ) : mediaSrc ? (
              <LazyImage
                src={mediaSrc}
                alt={post.caption ?? "Post"}
                objectFit="contain"
                className="h-full max-h-[70vh] w-full"
              />
            ) : null}

            {onPrev && (
              <button
                type="button"
                onClick={onPrev}
                aria-label="Previous post"
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur transition hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {onNext && (
              <button
                type="button"
                onClick={onNext}
                aria-label="Next post"
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur transition hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Sidebar */}
          <div
            className={cn(
              "min-h-[400px] flex-col border-border sm:flex sm:border-l",
              panel === "media" ? "hidden sm:flex" : "flex",
            )}
            role="tabpanel"
            aria-label="Comments"
          >
            {/* Creator Header */}
            {(post as any).trainer && (
              <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    const username = (post as any).trainer?.username ?? post.trainer_id;
                    navigate({ to: "/trainers/$username", params: { username } });
                  }}
                  className="group flex items-center gap-3 text-left transition-opacity hover:opacity-80"
                >
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border/80 bg-muted ring-1 ring-primary/20">
                    {(post as any).trainer?.avatar_url ? (
                      <img
                        src={(post as any).trainer.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">
                        {((post as any).trainer?.display_name ?? (post as any).trainer?.username ?? "?")[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 truncate text-xs font-bold text-foreground transition-colors group-hover:text-primary">
                      {(post as any).trainer?.display_name ?? (post as any).trainer?.username}
                      {(post as any).trainer?.is_verified && (
                        <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                      )}
                    </p>
                    {(post as any).trainer?.username && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        @{(post as any).trainer.username}
                      </p>
                    )}
                  </div>
                </button>
              </div>
            )}

            {post.caption && (
              <div className="border-b border-border p-4 text-sm">
                <p className="whitespace-pre-wrap">{post.caption}</p>
                <TranslateToggle text={post.caption} />
              </div>
            )}

            {/* Engagement bar */}
            <div className="flex items-center gap-1 border-b border-border px-2 py-2">
              <IconBtn
                active={!!engQ.data?.respect}
                onClick={() => requireAuth(() => respectMut.mutate())}
                disabled={respectMut.isPending}
                label={engQ.data?.respect ? "Remove respect" : "Respect post"}
                pressed={!!engQ.data?.respect}
                count={counts.respect_count}
                icon={
                  <Heart
                    className={cn(
                      "h-5 w-5",
                      engQ.data?.respect && "fill-primary text-primary",
                    )}
                  />
                }
              />
              <IconBtn
                onClick={() => onPanelChange?.("comments")}
                label={`View comments (${counts.comment_count})`}
                count={counts.comment_count}
                icon={<MessageCircle className="h-5 w-5" />}
              />
              <IconBtn
                active={!!engQ.data?.save}
                onClick={() => requireAuth(() => saveMut.mutate())}
                disabled={saveMut.isPending}
                label={engQ.data?.save ? "Remove save" : "Save post"}
                pressed={!!engQ.data?.save}
                count={counts.save_count}
                icon={
                  <Bookmark
                    className={cn(
                      "h-5 w-5",
                      engQ.data?.save && "fill-foreground text-foreground",
                    )}
                  />
                }
              />
              <IconBtn
                onClick={() => setShareOpen(true)}
                label="Share post"
                count={counts.share_count}
                icon={<Share2 className="h-5 w-5" />}
              />
            </div>
            <ShareSheet
              open={shareOpen}
              onOpenChange={setShareOpen}
              url={shareUrl}
              title={post.caption ?? "LEER Sports"}
              description={post.caption ?? undefined}
              onShared={handleShared}
            />

            {/* Comments */}
            <div className="min-h-0 flex-1">
              {locked ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Subscribe to view and add comments.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                      Comments
                    </span>
                    <div
                      role="group"
                      aria-label="Sort comments"
                      className="flex items-center gap-0.5"
                    >
                      {(["newest", "oldest"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => onCommentSortChange?.(s)}
                          aria-pressed={commentSort === s}
                          aria-label={`Sort comments: ${s}`}
                          className={cn(
                            "rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            commentSort === s
                              ? "bg-foreground text-background"
                              : "text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                <CommentThread
                  postId={post.id}
                  comments={allComments}
                  loading={commentsQ.isLoading}
                  hasNextPage={!!commentsQ.hasNextPage}
                  isFetchingNextPage={commentsQ.isFetchingNextPage}
                  onLoadMore={() => commentsQ.fetchNextPage()}
                  currentUserId={currentUserId}
                  onDelete={async (id) => {
                    await delMut.mutateAsync(id);
                  }}
                  sort={commentSort}
                  newCommentsCount={newCommentsCount}
                  onClearNewComments={() => setNewCommentsCount(0)}
                />
                </>
              )}
            </div>

            {/* Composer */}
            {!locked && (
              <CommentComposer
                onSubmit={async (body) => {
                  await addMut.mutateAsync(body);
                }}
                requireAuth={() => requireAuth(() => {})}
                isSignedIn={isSignedIn}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-widest transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

function IconBtn({
  icon,
  count,
  onClick,
  disabled,
  label,
  active,
  pressed,
}: {
  icon: React.ReactNode;
  count?: number;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  active?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={typeof pressed === "boolean" ? pressed : undefined}
      className={cn(
        "flex min-h-11 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
        active && "text-foreground",
      )}
    >
      {icon}
      {typeof count === "number" && <span>{count}</span>}
    </button>
  );
}

function CommentThread({
  postId,
  comments,
  loading,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  currentUserId,
  onDelete,
  sort,
  newCommentsCount,
  onClearNewComments,
}: {
  postId: string;
  comments: CommentNode[];
  loading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  currentUserId: string | null;
  onDelete: (id: string) => Promise<void>;
  sort: "newest" | "oldest";
  newCommentsCount: number;
  onClearNewComments: () => void;
}) {
  const tree = useMemo(() => {
    const byParent = new Map<string | null, CommentNode[]>();
    for (const c of comments) {
      const arr = byParent.get(c.parent_id) ?? [];
      arr.push(c);
      byParent.set(c.parent_id, arr);
    }
    return byParent;
  }, [comments]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollWrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const wrap = scrollWrapRef.current;
    const root =
      wrap?.querySelector<HTMLDivElement>("[data-radix-scroll-area-viewport]") ?? null;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !isFetchingNextPage) onLoadMore();
        }
      },
      { root, rootMargin: "240px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore, loading]);

  // Persist scroll offset per post id in sessionStorage; restore on mount/post switch.
  const storageKey = `post-scroll:${postId}`;
  useEffect(() => {
    const wrap = scrollWrapRef.current;
    if (!wrap) return;
    const viewport = wrap.querySelector<HTMLDivElement>(
      "[data-radix-scroll-area-viewport]",
    );
    if (!viewport) return;

    // Restore after content has painted.
    let restored = false;
    const tryRestore = () => {
      if (restored) return;
      const saved = sessionStorage.getItem(storageKey);
      if (saved != null) {
        viewport.scrollTop = Number(saved) || 0;
      }
      restored = true;
    };
    const raf = requestAnimationFrame(tryRestore);

    let saveT: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (!restored) return;
      if (saveT) clearTimeout(saveT);
      saveT = setTimeout(() => {
        sessionStorage.setItem(storageKey, String(viewport.scrollTop));
      }, 120);
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      if (saveT) clearTimeout(saveT);
      viewport.removeEventListener("scroll", onScroll);
    };
  }, [storageKey, loading, comments.length]);

  // Track whether the viewer is parked at the "latest" edge so the
  // new-comments pill can auto-hide once they arrive at it.
  const [atLatestEdge, setAtLatestEdge] = useState(true);
  useEffect(() => {
    const wrap = scrollWrapRef.current;
    const viewport = wrap?.querySelector<HTMLDivElement>(
      "[data-radix-scroll-area-viewport]",
    );
    if (!viewport) return;
    const check = () => {
      const threshold = 24;
      if (sort === "newest") {
        setAtLatestEdge(viewport.scrollTop <= threshold);
      } else {
        const max = viewport.scrollHeight - viewport.clientHeight;
        setAtLatestEdge(max - viewport.scrollTop <= threshold);
      }
    };
    check();
    viewport.addEventListener("scroll", check, { passive: true });
    return () => viewport.removeEventListener("scroll", check);
  }, [sort, comments.length, loading]);

  useEffect(() => {
    if (atLatestEdge && newCommentsCount > 0) onClearNewComments();
  }, [atLatestEdge, newCommentsCount, onClearNewComments]);

  const jumpToLatest = () => {
    const viewport = scrollWrapRef.current?.querySelector<HTMLDivElement>(
      "[data-radix-scroll-area-viewport]",
    );
    if (!viewport) return;
    viewport.scrollTo({
      top: sort === "newest" ? 0 : viewport.scrollHeight,
      behavior: "smooth",
    });
    onClearNewComments();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  const roots = tree.get(null) ?? [];
  if (roots.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Be the first to comment.
      </div>
    );
  }

  const showPill = newCommentsCount > 0 && !atLatestEdge;

  return (
    <div ref={scrollWrapRef} className="relative h-full">
      {showPill && (
        <button
          type="button"
          onClick={jumpToLatest}
          className={cn(
            "absolute left-1/2 z-10 -translate-x-1/2 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-medium uppercase tracking-widest text-background shadow-lg transition-all hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            sort === "newest" ? "top-2" : "bottom-2",
          )}
          aria-live="polite"
          aria-label={`${newCommentsCount} new comment${newCommentsCount === 1 ? "" : "s"} — jump to latest`}
        >
          <span className="inline-flex items-center gap-1.5">
            {sort === "newest" ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {newCommentsCount} new
          </span>
        </button>
      )}
    <ScrollArea className="h-[320px]">
      <ul className="space-y-3 p-4">
        {roots.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            replies={tree.get(c.id) ?? []}
            currentUserId={currentUserId}
            onDelete={onDelete}
          />
        ))}
      </ul>
      <div ref={sentinelRef} />
      {isFetchingNextPage && (
        <div className="flex items-center justify-center py-3 text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Loading more…
        </div>
      )}
      {hasNextPage && !isFetchingNextPage && (
        <div className="flex justify-center py-3">
          <button
            type="button"
            onClick={onLoadMore}
            className="text-xs uppercase tracking-widest text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Load more comments
          </button>
        </div>
      )}
      {!hasNextPage && roots.length > 5 && (
        <div className="py-3 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
          End of thread
        </div>
      )}
    </ScrollArea>
    </div>
  );
}

function CommentItem({
  comment,
  replies,
  currentUserId,
  onDelete,
}: {
  comment: PendingCommentNode;
  replies: PendingCommentNode[];
  currentUserId: string | null;
  onDelete: (id: string) => Promise<void>;
}) {
  const isMine = currentUserId === comment.author_id;
  const isPending = !!comment.pending;
  return (
    <li
      className={cn(
        "transition-opacity",
        isPending && "opacity-60",
      )}
      aria-busy={isPending || undefined}
    >
      <div className="flex items-start gap-2">
        <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-muted">
          {comment.author.avatar_url ? (
            <img
              src={comment.author.avatar_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
              {(comment.author.display_name ?? comment.author.username ?? "?")[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-xs font-medium">
              {comment.author.display_name ?? comment.author.username ?? "User"}
            </span>
            {isMine && !isPending && (
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
                aria-label="Delete comment"
                className="rounded px-1 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Delete
              </button>
            )}
            {isPending && (
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Sending…
              </span>
            )}
          </div>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">
            {comment.body}
          </p>
        </div>
      </div>
      {replies.length > 0 && (
        <ul className="mt-2 space-y-2 border-l border-border pl-4">
          {replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              replies={[]}
              currentUserId={currentUserId}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function CommentComposer({
  onSubmit,
  requireAuth,
  isSignedIn,
}: {
  onSubmit: (body: string) => Promise<void>;
  requireAuth: () => void;
  isSignedIn: boolean;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX = 2000;
  const trimmed = body.trim();
  const remaining = MAX - body.length;
  const nearLimit = remaining <= 100;

  const validate = (value: string): string | null => {
    if (!value.trim()) return "Comment can't be empty.";
    if (value.trim().length < 2) return "Comment must be at least 2 characters.";
    if (value.length > MAX) return `Comment must be ${MAX} characters or fewer.`;
    return null;
  };

  const submit = async () => {
    if (!isSignedIn) return requireAuth();
    const msg = validate(body);
    if (msg) {
      setError(msg);
      return;
    }
    setError(null);
    try {
      setBusy(true);
      await onSubmit(trimmed);
      setBody("");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to post comment.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const errorId = "comment-composer-error";
  const counterId = "comment-composer-counter";
  const disabled = busy || !trimmed || trimmed.length < 2 || body.length > MAX;

  return (
    <div className="border-t border-border p-3">
      <div className="flex items-end gap-2">
        <Textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={isSignedIn ? "Add a comment…" : "Sign in to comment"}
          rows={2}
          maxLength={MAX}
          disabled={busy}
          onFocus={() => !isSignedIn && requireAuth()}
          aria-invalid={!!error}
          aria-describedby={`${error ? errorId + " " : ""}${counterId}`}
          className={`min-h-[44px] resize-none ${error ? "border-destructive focus-visible:ring-destructive" : ""}`}
        />
        <Button
          size="sm"
          onClick={submit}
          disabled={disabled}
          aria-label="Post comment"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs">
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className={`text-destructive ${error ? "" : "sr-only"}`}
        >
          {error ?? ""}
        </p>
        <span
          id={counterId}
          className={`ml-auto tabular-nums ${nearLimit ? "text-destructive" : "text-muted-foreground"}`}
        >
          {body.length}/{MAX}
        </span>
      </div>
    </div>
  );
}
