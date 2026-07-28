import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Heart,
  Bookmark,
  Share2,
  MessageCircle,
  BadgeCheck,
  Lock,
  ArrowLeft,
  MapPin,
  Play,
  Loader2,
  Send,
  Eye,
  Copy,
  Check,
  Share,
} from "lucide-react";
import { toast } from "sonner";
import { getPostDetail } from "@/lib/trainer-functions";
import {
  getPostEngagement,
  toggleRespect,
  toggleSave,
  logShare,
  logPostView,
  listCommentsPage,
  addComment,
  type CommentNode,
} from "@/lib/engagement-functions";
import type { PostEngagement } from "@/lib/engagement-functions";
import { getPostUnlockInfo, unlockPost, type UnlockInfo } from "@/lib/unlock-functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const postQuery = (postId: string) =>
  queryOptions({
    queryKey: ["post-detail", postId],
    queryFn: () => getPostDetail({ data: { postId } }),
  });

export const Route = createFileRoute("/posts/$postId")({
  loader: async ({ context, params }) => {
    try {
      const post = await context.queryClient.ensureQueryData(postQuery(params.postId));
      if (!post) throw notFound();
      return { post };
    } catch (e) {
      if (e instanceof Error && e.message === "Not Found") throw e;
      console.error("Post detail loader error:", e);
      return { post: null };
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData?.post) {
      return {
        meta: [
          { title: "Post not found — LEER Sports" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const p = loaderData.post;
    const author =
      p.trainer.display_name ?? p.trainer.username ?? "an athlete";
    const title = p.caption
      ? `${truncate(p.caption, 60)} — ${author} · LEER Sports`
      : `${author} on LEER Sports`;
    const desc = p.caption
      ? truncate(p.caption, 155)
      : `A ${p.kind === "short" ? "reel" : "post"} by ${author} on LEER Sports.`;
    const ogImage = !p.is_premium
      ? p.thumbnail_url ?? (p.kind === "feed" ? p.media_url : null)
      : null;
    const meta = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (ogImage && /^https?:\/\//.test(ogImage)) {
      meta.push({ property: "og:image", content: ogImage });
      meta.push({ name: "twitter:image", content: ogImage });
    }
    return { meta };
  },
  component: PostDetailPage,
  notFoundComponent: () => <NotFoundState />,
  errorComponent: ({ error }) => <ErrorState error={error} />,
});

function truncate(s: string, n: number) {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function PostDetailPage() {
  const { postId } = Route.useParams();
  const { data: post } = useSuspenseQuery(postQuery(postId));
  const qc = useQueryClient();

  const [userId, setUserId] = useState<string | null>(null);
  const signedIn = !!userId;
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) =>
      setUserId(session?.user?.id ?? null),
    );
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!post) return <NotFoundState />;

  const trainerHref = post.trainer.username ?? post.trainer.user_id;
  const trainerName =
    post.trainer.display_name ?? post.trainer.username ?? "Athlete";

  const getEng = useServerFn(getPostEngagement);
  const respectFn = useServerFn(toggleRespect);
  const saveFn = useServerFn(toggleSave);
  const shareFn = useServerFn(logShare);
  const listPage = useServerFn(listCommentsPage);
  const addFn = useServerFn(addComment);
  const viewFn = useServerFn(logPostView);
  const unlockInfoFn = useServerFn(getPostUnlockInfo);
  const unlockFn = useServerFn(unlockPost);

  // Log a view once per session per post (best-effort, non-blocking).
  useEffect(() => {
    if (!post?.id) return;
    const key = `viewed:${post.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    viewFn({ data: { postId: post.id } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id]);

  const engQ = useQuery({
    queryKey: ["post-engagement", post.id],
    queryFn: () => getEng({ data: { postId: post.id } }),
    enabled: signedIn,
  });

  // Server-side unlock gate — returns a fresh signed URL when the caller
  // owns, subscribes to, or has purchased this post.
  const unlockKey = ["post-unlock", post.id] as const;
  const unlockQ = useQuery({
    queryKey: unlockKey,
    queryFn: () => unlockInfoFn({ data: { postId: post.id } }),
    enabled: signedIn && post.is_premium,
    staleTime: 30 * 60 * 1000,
  });
  const unlockMut = useMutation({
    mutationFn: () => unlockFn({ data: { postId: post.id } }),
    onSuccess: (res) => {
      toast.success(res.alreadyUnlocked ? "Already unlocked" : "Unlocked");
      qc.invalidateQueries({ queryKey: unlockKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const unlockInfo: UnlockInfo | undefined = unlockQ.data;
  const effectiveMediaUrl = post.is_premium
    ? unlockInfo?.media_url ?? null
    : post.media_url;
  const effectiveThumbUrl = post.is_premium
    ? unlockInfo?.thumbnail_url ?? null
    : post.thumbnail_url;
  const isVideo =
    post.kind === "short" ||
    /\.(mp4|webm|mov)(\?|$)/i.test(effectiveMediaUrl ?? "");
  const locked = post.is_premium && !unlockInfo?.unlocked;
  const unlockPrice = unlockInfo?.price ?? 0;
  const unlockCurrency = unlockInfo?.currency ?? "USD";

  const engKey = ["post-engagement", post.id] as const;

  const respectMut = useMutation({
    mutationFn: () => respectFn({ data: { postId: post.id } }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: engKey });
      const prev = qc.getQueryData<PostEngagement>(engKey);
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
      const nextActive = !base.respect;
      qc.setQueryData<PostEngagement>(engKey, {
        ...base,
        respect: nextActive,
        counts: {
          ...base.counts,
          respect_count: Math.max(0, base.counts.respect_count + (nextActive ? 1 : -1)),
        },
      });
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(engKey, ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: engKey }),
  });

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { postId: post.id } }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: engKey });
      const prev = qc.getQueryData<PostEngagement>(engKey);
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
      const nextActive = !base.save;
      qc.setQueryData<PostEngagement>(engKey, {
        ...base,
        save: nextActive,
        counts: {
          ...base.counts,
          save_count: Math.max(0, base.counts.save_count + (nextActive ? 1 : -1)),
        },
      });
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(engKey, ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: engKey }),
  });
  const [shareBusy, setShareBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "error">("idle");

  // Canonical share URL for this post — never leak query/hash state from the current URL.
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/posts/${post.id}`
      : `/posts/${post.id}`;
  const nativeShareSupported =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const commentsQ = useInfiniteQuery({
    queryKey: ["post-comments", post.id, "newest"],
    queryFn: ({ pageParam }) =>
      listPage({
        data: {
          postId: post.id,
          cursor: pageParam,
          limit: 20,
          sort: "newest",
        },
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: signedIn && !locked,
  });
  const allComments = useMemo<CommentNode[]>(
    () => (commentsQ.data?.pages ?? []).flatMap((p) => p.comments),
    [commentsQ.data],
  );
  const rootComments = allComments.filter((c) => !c.parent_id);

  // Infinite scroll sentinel for comments.
  const commentsSentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = commentsSentinelRef.current;
    if (!el) return;
    if (!commentsQ.hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (
            e.isIntersecting &&
            commentsQ.hasNextPage &&
            !commentsQ.isFetchingNextPage
          ) {
            commentsQ.fetchNextPage();
          }
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [commentsQ.hasNextPage, commentsQ.isFetchingNextPage, commentsQ.fetchNextPage]);

  // Realtime: refresh comments + engagement when new comments arrive for this post.
  useEffect(() => {
    if (!post?.id || locked) return;
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
          qc.invalidateQueries({ queryKey: ["post-comments", post.id, "newest"] });
          qc.invalidateQueries({ queryKey: ["post-engagement", post.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [post?.id, locked, qc]);

  const counts = engQ.data?.counts ?? {
    respect_count: post.respect_count,
    save_count: post.save_count,
    comment_count: 0,
    share_count: 0,
  };

  const logShareChannel = (channel: string) => {
    if (signedIn) shareFn({ data: { postId: post.id, channel } }).catch(() => {});
  };

  const handleShare = () => {
    setCopyState("idle");
    setShareOpen(true);
  };

  const copyToClipboard = async () => {
    if (copyState === "copying") return;
    setCopyState("copying");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for older browsers.
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopyState("copied");
      logShareChannel("clipboard");
      toast.success("Link copied");
      setTimeout(() => setCopyState((s) => (s === "copied" ? "idle" : s)), 2000);
    } catch {
      setCopyState("error");
      toast.error("Couldn't copy — you can select the link manually.");
    }
  };

  const nativeShare = async () => {
    if (!nativeShareSupported || shareBusy) return;
    setShareBusy(true);
    try {
      await navigator.share({
        url: shareUrl,
        title: (post.caption ?? `${trainerName} on LEER Sports`).slice(0, 80),
        text: post.caption ?? undefined,
      });
      logShareChannel("native");
      setShareOpen(false);
    } catch {
      // User dismissed — no-op.
    } finally {
      setShareBusy(false);
    }
  };

  const previewImg =
    !post.is_premium
      ? post.thumbnail_url ?? (isVideo ? null : post.media_url)
      : null;

  const created = new Date(post.created_at);
  const createdLabel = created.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:pt-10">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Link
          to="/feed"
          className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-3 py-1 hover:bg-muted"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to feed
        </Link>
      </nav>

      <article className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Media column */}
        <section aria-label="Post media" className="relative overflow-hidden rounded-2xl border border-border bg-black">
          <div className="relative flex aspect-square w-full items-center justify-center sm:aspect-auto sm:min-h-[520px]">
            {locked ? (
              <div className="flex flex-col items-center gap-3 p-10 text-center text-white/85">
                <Lock className="h-8 w-8 text-primary" />
                <p className="font-display uppercase tracking-widest text-primary">Premium</p>
                <p className="max-w-sm text-sm text-white/70">
                  Unlock this post from {trainerName} — one-time purchase, yours forever.
                </p>
                {signedIn ? (
                  <Button
                    type="button"
                    onClick={() => unlockMut.mutate()}
                    disabled={unlockMut.isPending || unlockPrice <= 0}
                    className="mt-2 rounded-full px-5"
                    style={{
                      backgroundColor: "var(--premium)",
                      color: "var(--premium-foreground)",
                    }}
                  >
                    {unlockMut.isPending ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Unlocking…
                      </>
                    ) : (
                      <>
                        <Lock className="mr-1.5 h-3.5 w-3.5" />
                        Unlock · {unlockCurrency === "USD" ? "$" : ""}
                        {unlockPrice.toFixed(2)}
                      </>
                    )}
                  </Button>
                ) : (
                  <Link
                    to="/auth"
                    className="mt-2 inline-flex items-center rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground"
                  >
                    Sign in to unlock
                  </Link>
                )}
                <Link
                  to="/trainers/$username"
                  params={{ username: trainerHref }}
                  className="text-[10px] uppercase tracking-widest text-white/50 hover:text-white/80"
                >
                  Or subscribe to {trainerName}
                </Link>
              </div>
            ) : isVideo && effectiveMediaUrl ? (
              <video
                src={effectiveMediaUrl}
                controls
                playsInline
                poster={effectiveThumbUrl ?? undefined}
                className="h-full max-h-[80vh] w-full object-contain"
              />
            ) : effectiveMediaUrl ? (
              <img
                src={effectiveMediaUrl}
                alt={post.caption ?? `Post by ${trainerName}`}
                className="h-full max-h-[80vh] w-full object-contain"
              />
            ) : (
              <div className="p-10 text-sm text-white/60">No media</div>
            )}
            {post.kind === "short" && (
              <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white ring-1 ring-white/15 backdrop-blur">
                <Play className="h-2.5 w-2.5 fill-current" /> Reel
              </span>
            )}
          </div>
        </section>

        {/* Details column */}
        <section aria-label="Post details" className="flex flex-col gap-6">
          {/* Author card */}
          <header className="rounded-2xl border border-border bg-card p-5">
            <Link
              to="/trainers/$username"
              params={{ username: trainerHref }}
              className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-background">
                {post.trainer.avatar_url ? (
                  <img
                    src={post.trainer.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-primary/40 to-accent/40" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">
                    {trainerName}
                  </span>
                  {post.trainer.is_verified && (
                    <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Verified" />
                  )}
                </div>
                {post.trainer.username && (
                  <div className="truncate text-xs text-muted-foreground">
                    @{post.trainer.username}
                  </div>
                )}
              </div>
            </Link>
            {post.trainer.bio && (
              <p className="mt-3 line-clamp-3 text-xs text-muted-foreground">
                {post.trainer.bio}
              </p>
            )}
            {post.trainer.country && (
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{post.trainer.country}</span>
              </div>
            )}
          </header>

          {/* Caption + meta */}
          <div className="rounded-2xl border border-border bg-card p-5">
            {post.caption ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {post.caption}
              </p>
            ) : (
              <p className="text-sm italic text-muted-foreground">No caption</p>
            )}
            <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
              <MetaStat
                icon={<Heart className="h-4 w-4" />}
                label="Respects"
                value={counts.respect_count}
              />
              <MetaStat
                icon={<MessageCircle className="h-4 w-4" />}
                label="Comments"
                value={counts.comment_count}
              />
              <MetaStat
                icon={<Eye className="h-4 w-4" />}
                label="Views"
                value={post.view_count}
              />
            </dl>
            <p className="mt-4 text-[11px] uppercase tracking-widest text-muted-foreground">
              Posted <time dateTime={post.created_at}>{createdLabel}</time>
            </p>
          </div>

          {/* Engagement actions */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
            <ActionButton
              onClick={() => {
                if (!signedIn) {
                  toast.error("Sign in to respect posts");
                  return;
                }
                if (!respectMut.isPending) respectMut.mutate();
              }}
              disabled={respectMut.isPending}
              active={!!engQ.data?.respect}
              icon={
                <Heart
                  className={cn(
                    "h-4 w-4",
                    engQ.data?.respect && "fill-primary text-primary",
                  )}
                />
              }
              label="Respect"
              count={counts.respect_count}
            />
            <ActionButton
              onClick={() => {
                if (!signedIn) {
                  toast.error("Sign in to save posts");
                  return;
                }
                if (!saveMut.isPending) saveMut.mutate();
              }}
              disabled={saveMut.isPending}
              active={!!engQ.data?.save}
              icon={
                <Bookmark
                  className={cn(
                    "h-4 w-4",
                    engQ.data?.save && "fill-foreground text-foreground",
                  )}
                />
              }
              label="Save"
              count={counts.save_count}
            />
            <ActionButton
              onClick={handleShare}
              disabled={shareBusy}
              icon={<Share2 className="h-4 w-4" />}
              label="Share"
            />
          </div>

          <Dialog open={shareOpen} onOpenChange={setShareOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Share this post</DialogTitle>
                <DialogDescription>
                  Anyone with the link can view {post.is_premium ? "the preview" : "this post"}.
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                  {previewImg ? (
                    <img
                      src={previewImg}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 to-accent/30">
                      {isVideo ? (
                        <Play className="h-5 w-5 fill-current text-white/90" />
                      ) : (
                        <Lock className="h-4 w-4 text-white/80" />
                      )}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{trainerName}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {post.caption ?? `A ${post.kind === "short" ? "reel" : "post"} on LEER Sports.`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Post link"
                  className="flex-1 truncate bg-transparent text-xs outline-none"
                />
                <Button
                  type="button"
                  size="sm"
                  variant={copyState === "copied" ? "outline" : "default"}
                  onClick={copyToClipboard}
                  disabled={copyState === "copying"}
                  aria-live="polite"
                  className="min-w-[92px]"
                >
                  {copyState === "copying" ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Copying
                    </>
                  ) : copyState === "copied" ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </Button>
              </div>

              <DialogFooter className="sm:justify-between">
                {nativeShareSupported ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={nativeShare}
                    disabled={shareBusy}
                  >
                    {shareBusy ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Share className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Share via…
                  </Button>
                ) : (
                  <span />
                )}
                <Button type="button" variant="ghost" onClick={() => setShareOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Comments */}
          <section aria-label="Comments" className="rounded-2xl border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Comments · {counts.comment_count || rootComments.length}
              </h2>
            </header>

            {!signedIn ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <Link
                  to="/auth"
                  className="font-medium text-primary underline underline-offset-4"
                >
                  Sign in
                </Link>{" "}
                to view and post comments.
              </div>
            ) : locked ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Subscribe to view and post comments.
              </div>
            ) : (
              <>
                <CommentComposer
                  onSubmit={async (body) => {
                    // Optimistically bump comment count immediately.
                    const prev = qc.getQueryData<PostEngagement>(engKey);
                    qc.setQueryData<PostEngagement>(engKey, (p) =>
                      p
                        ? { ...p, counts: { ...p.counts, comment_count: p.counts.comment_count + 1 } }
                        : p,
                    );
                    try {
                      await addFn({ data: { postId: post.id, body } });
                      qc.invalidateQueries({ queryKey: ["post-comments", post.id, "newest"] });
                      qc.invalidateQueries({ queryKey: ["post-engagement", post.id] });
                    } catch (err) {
                      // Revert optimistic bump on failure.
                      if (prev) qc.setQueryData(engKey, prev);
                      throw err;
                    }
                  }}
                />
                <ul className="divide-y divide-border">
                  {commentsQ.isLoading ? (
                    <>
                      {Array.from({ length: 4 }).map((_, i) => (
                        <CommentRowSkeleton key={i} />
                      ))}
                    </>
                  ) : rootComments.length === 0 ? (
                    <li className="p-6 text-center text-sm text-muted-foreground">
                      Be the first to comment.
                    </li>
                  ) : (
                    <>
                      {rootComments.map((c) => (
                        <CommentRow key={c.id} c={c} />
                      ))}
                      {commentsQ.isFetchingNextPage &&
                        Array.from({ length: 2 }).map((_, i) => (
                          <CommentRowSkeleton key={`s-${i}`} />
                        ))}
                    </>
                  )}
                </ul>
                {/* Sentinel drives infinite scroll; button is manual fallback. */}
                <div ref={commentsSentinelRef} aria-hidden="true" className="h-1" />
                {commentsQ.hasNextPage ? (
                  <div className="p-3 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={commentsQ.isFetchingNextPage}
                      onClick={() => commentsQ.fetchNextPage()}
                    >
                      {commentsQ.isFetchingNextPage ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Loading…
                        </>
                      ) : (
                        "Load more comments"
                      )}
                    </Button>
                  </div>
                ) : rootComments.length > 5 ? (
                  <div className="p-3 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
                    End of comments
                  </div>
                ) : null}
              </>
            )}
          </section>
        </section>
      </article>
    </main>
  );
}

function MetaStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <dt className="text-[10px] uppercase tracking-widest">{label}</dt>
      </div>
      <dd className="text-lg font-semibold tabular-nums">{value.toLocaleString()}</dd>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  count,
  active,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-medium transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
        active && "border-primary/50 bg-primary/5",
      )}
    >
      {icon}
      <span>{label}</span>
      {typeof count === "number" && (
        <span className="tabular-nums text-muted-foreground">{count}</span>
      )}
    </button>
  );
}

function CommentComposer({ onSubmit }: { onSubmit: (body: string) => Promise<void> }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const canSubmit = body.trim().length > 0 && !busy;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setBusy(true);
        try {
          await onSubmit(body.trim());
          setBody("");
          ref.current?.focus();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to comment");
        } finally {
          setBusy(false);
        }
      }}
      className="flex items-end gap-2 border-b border-border p-3"
    >
      <Textarea
        ref={ref}
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a comment…"
        className="min-h-[52px] flex-1 resize-none text-sm"
      />
      <Button type="submit" size="sm" disabled={!canSubmit}>
        <Send className="mr-1 h-3.5 w-3.5" />
        Post
      </Button>
    </form>
  );
}

function CommentRow({ c }: { c: CommentNode }) {
  const name = c.author.display_name ?? c.author.username ?? "User";
  const when = new Date(c.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return (
    <li className="flex gap-3 p-4">
      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
        {c.author.avatar_url ? (
          <img src={c.author.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/40 to-accent/40" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          {c.author.username ? (
            <Link
              to="/u/$username"
              params={{ username: c.author.username }}
              className="text-xs font-semibold hover:underline"
            >
              {name}
            </Link>
          ) : (
            <span className="text-xs font-semibold">{name}</span>
          )}
          <span className="text-[10px] text-muted-foreground">{when}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
      </div>
    </li>
  );
}

function NotFoundState() {
  return NotFoundStateImpl();
}

function CommentRowSkeleton() {
  return (
    <li className="flex gap-3 p-4">
      <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
      </div>
    </li>
  );
}

function NotFoundStateImpl() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-display text-2xl">Post not found</h1>
      <p className="text-sm text-muted-foreground">
        This post may have been removed or is no longer available.
      </p>
      <Link
        to="/feed"
        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to feed
      </Link>
    </main>
  );
}

function ErrorState({ error }: { error: Error }) {
  const isHtml = error?.message?.includes("<html") || error?.message?.includes("<!doctype");
  const cleanMsg = isHtml
    ? "Unable to connect to the server. Please check your network connection and try again."
    : error?.message || "Something went wrong loading this post.";
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">{cleanMsg}</p>
      <Link
        to="/feed"
        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground shadow-md"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to feed
      </Link>
    </main>
  );
}