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
  Heart,
  Bookmark,
  MessageCircle,
  Share2,
  Lock,
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
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
import type { Post } from "@/lib/trainer-functions";
import { TranslateToggle } from "./translate-toggle";
import {
  addComment,
  deleteComment,
  getPostEngagement,
  listCommentsPage,
  logShare,
  toggleRespect,
  toggleSave,
  type CommentNode,
} from "@/lib/engagement-functions";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

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
  const locked = post.is_premium && !unlockedUrl;

  const mediaSrc = post.is_premium
    ? unlockedUrl ?? ""
    : post.media_url;
  const isVideo =
    post.kind === "short" ||
    /\.(mp4|webm|mov)(\?|$)/i.test(mediaSrc);

  const getEng = useServerFn(getPostEngagement);
  const listPage = useServerFn(listCommentsPage);
  const respectFn = useServerFn(toggleRespect);
  const saveFn = useServerFn(toggleSave);
  const shareFn = useServerFn(logShare);
  const addFn = useServerFn(addComment);
  const delFn = useServerFn(deleteComment);

  const engQ = useQuery({
    queryKey: ["post-engagement", post.id],
    queryFn: () => getEng({ data: { postId: post.id } }),
    enabled: isSignedIn && open,
  });
  const commentsQ = useInfiniteQuery({
    queryKey: ["post-comments", post.id, commentSort],
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
    enabled: isSignedIn && open && !locked,
  });

  const allComments = useMemo<CommentNode[]>(
    () => (commentsQ.data?.pages ?? []).flatMap((p) => p.comments),
    [commentsQ.data],
  );

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
        () => {
          qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
          qc.invalidateQueries({ queryKey: ["post-engagement", post.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, locked, post.id, qc]);

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

  const respectMut = useMutation({
    mutationFn: () => respectFn({ data: { postId: post.id } }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["post-engagement", post.id] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { postId: post.id } }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["post-engagement", post.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const requireAuth = (cb: () => void) => {
    if (!isSignedIn) {
      navigate({ to: "/auth" });
      return;
    }
    cb();
  };

  const handleShare = async () => {
    const url = window.location.href;
    let channel: string | null = null;
    if (navigator.share) {
      try {
        await navigator.share({ url, title: post.caption ?? "LEER Sports" });
        channel = "native";
      } catch {
        return;
      }
    } else {
      await navigator.clipboard.writeText(url);
      channel = "clipboard";
      toast.success("Link copied");
    }
    if (isSignedIn && channel) {
      shareFn({ data: { postId: post.id, channel } }).catch(() => {});
    }
  };

  const counts = engQ.data?.counts ?? {
    respect_count: post.respect_count,
    save_count: post.save_count,
    comment_count: 0,
  };

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
              <video
                src={mediaSrc}
                controls
                playsInline
                className="h-full max-h-[70vh] w-full object-contain"
              />
            ) : mediaSrc ? (
              <img
                src={mediaSrc}
                alt={post.caption ?? "Post"}
                className="h-full max-h-[70vh] w-full object-contain"
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
                onClick={handleShare}
                label="Share post"
                icon={<Share2 className="h-5 w-5" />}
              />
            </div>

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
                    await delFn({ data: { commentId: id } });
                    qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
                    qc.invalidateQueries({ queryKey: ["post-engagement", post.id] });
                  }}
                />
                </>
              )}
            </div>

            {/* Composer */}
            {!locked && (
              <CommentComposer
                onSubmit={async (body) => {
                  await addFn({ data: { postId: post.id, body } });
                  qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
                  qc.invalidateQueries({ queryKey: ["post-engagement", post.id] });
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
}: {
  postId: string;
  comments: CommentNode[];
  loading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  currentUserId: string | null;
  onDelete: (id: string) => Promise<void>;
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
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !isFetchingNextPage) onLoadMore();
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  // Persist scroll offset per post id in sessionStorage; restore on mount/post switch.
  const scrollWrapRef = useRef<HTMLDivElement | null>(null);
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

  return (
    <div ref={scrollWrapRef} className="h-full">
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
  comment: CommentNode;
  replies: CommentNode[];
  currentUserId: string | null;
  onDelete: (id: string) => Promise<void>;
}) {
  const isMine = currentUserId === comment.author_id;
  return (
    <li>
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
            {isMine && (
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
                aria-label="Delete comment"
                className="rounded px-1 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Delete
              </button>
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

  const submit = async () => {
    if (!isSignedIn) return requireAuth();
    const trimmed = body.trim();
    if (!trimmed) return;
    if (trimmed.length > 2000) {
      toast.error("Comment is too long.");
      return;
    }
    try {
      setBusy(true);
      await onSubmit(trimmed);
      setBody("");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to post comment.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-end gap-2 border-t border-border p-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={isSignedIn ? "Add a comment…" : "Sign in to comment"}
        rows={2}
        maxLength={2000}
        disabled={busy}
        onFocus={() => !isSignedIn && requireAuth()}
        className="min-h-[44px] resize-none"
      />
      <Button
        size="sm"
        onClick={submit}
        disabled={busy || !body.trim()}
        aria-label="Post comment"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  );
}