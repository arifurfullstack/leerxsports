import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BadgeCheck,
  Bookmark,
  Heart,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Send,
  Share2,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { openAuthGate } from "@/lib/auth-gate";
import {
  toggleRespect,
  toggleSave,
  logShare,
  addComment,
  syncGlobalPostCounts,
  type PostEngagement,
} from "@/lib/engagement-functions";
import { ResponsiveImage } from "@/components/responsive-image";
import { VideoPlayer } from "@/components/video-player";
import { ShareSheet } from "@/components/share-sheet";
import { TranslateToggle } from "@/components/translate-toggle";
import { NewContentBadge, NewContentAvatarRing } from "@/components/new-content-badge";
import { markPostAsSeen } from "@/lib/fresh-content-tracker";
import type { getDiscoveryFeed } from "@/lib/trainer-functions";

type FeedPost = Awaited<ReturnType<typeof getDiscoveryFeed>>[number];

export function InstaFeedCard({
  post,
  priority = false,
  signedIn,
  initialLiked,
  initialSaved,
  isFollowing,
  canFollow,
  followPending,
  onToggleFollow,
  onOpen,
  onOpenComments,
  registerRef,
  ownerMenu,
}: {
  post: FeedPost;
  priority?: boolean;
  signedIn: boolean;
  initialLiked: boolean;
  initialSaved: boolean;
  isFollowing: boolean;
  canFollow: boolean;
  followPending: boolean;
  onToggleFollow: () => void;
  onOpen: (seed: {
    liked: boolean;
    saved: boolean;
    respectCount: number;
    saveCount: number;
  }) => void;
  onOpenComments: () => void;
  registerRef?: (el: HTMLElement | null) => void;
  ownerMenu?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const respectFn = useServerFn(toggleRespect);
  const saveFn = useServerFn(toggleSave);
  const shareFn = useServerFn(logShare);
  const addCommentFn = useServerFn(addComment);

  const [liked, setLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(initialSaved);
  const [shareOpen, setShareOpen] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [inlineCommentText, setInlineCommentText] = useState("");

  const commentMut = useMutation({
    mutationFn: (text: string) => {
      if (!signedIn) {
        openAuthGate({ action: "comment on posts" });
        throw new Error("Unauthorized");
      }
      return addCommentFn({ data: { postId: post.id, body: text } });
    },
    onSuccess: () => {
      setInlineCommentText("");
      syncGlobalPostCounts(qc, post.id, { commentDelta: 1 });
      toast.success("Comment posted!");
      qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
      qc.invalidateQueries({ queryKey: ["discovery-feed"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (err: Error) => {
      if (!err.message.includes("Unauthorized")) {
        toast.error(err.message || "Failed to post comment");
      }
    },
  });
  const [burst, setBurst] = useState<{ x: number; y: number; id: number } | null>(null);
  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const burstCooldownRef = useRef<number>(0);
  const pointerRef = useRef<{
    id: number;
    x: number;
    y: number;
    t: number;
    type: string;
    moved: boolean;
  } | null>(null);
  const mediaWrapRef = useRef<HTMLDivElement | null>(null);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => setLiked(initialLiked), [initialLiked]);
  useEffect(() => setSaved(initialSaved), [initialSaved]);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  const handleMediaClick = (e: React.MouseEvent) => {
    if (clickTimerRef.current) {
      // 2nd click within window -> Double-click Instagram reaction!
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      if (signedIn) {
        doubleTapLike(e.clientX, e.clientY);
      } else {
        openAuthGate({ action: "like posts" });
      }
    } else {
      // 1st click -> set 250ms timer for single-click post detail modal
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        onOpen({ liked, saved, respectCount, saveCount });
      }, 250);
    }
  };

  const engCache = qc.getQueryData<PostEngagement>(["post-engagement", post.id]);
  const activeLiked = engCache?.respect ?? liked;
  const activeSaved = engCache?.save ?? saved;

  const respectCount = Math.max(0, post.respect_count);
  const saveCount = Math.max(0, post.save_count);

  const trainerHref = post.trainer.username ?? post.trainer.user_id;
  const displayName =
    post.trainer.display_name ?? post.trainer.username ?? "creator";
  const handle = post.trainer.username;
  const isVideo = post.kind === "short";
  const media = post.media_url;
  const thumb = post.thumbnail_url ?? post.media_url;

  const likeMut = useMutation({
    mutationFn: () => {
      if (!signedIn) {
        openAuthGate({ action: "like posts" });
        throw new Error("Unauthorized");
      }
      return respectFn({ data: { postId: post.id } });
    },
    onMutate: () => {
      const nextLiked = !activeLiked;
      setLiked(nextLiked);
      syncGlobalPostCounts(qc, post.id, { respectDelta: nextLiked ? 1 : -1 });
      qc.setQueryData<PostEngagement>(["post-engagement", post.id], (prev) => {
        const base: PostEngagement = prev ?? {
          respect: initialLiked,
          save: initialSaved,
          counts: {
            respect_count: post.respect_count,
            save_count: post.save_count,
            comment_count: post.comment_count ?? 0,
            share_count: 0,
          },
        };
        return {
          ...base,
          respect: nextLiked,
          counts: {
            ...base.counts,
            respect_count: Math.max(0, base.counts.respect_count + (nextLiked ? 1 : -1)),
          },
        };
      });
    },
    onError: (err: Error) => {
      const prevLiked = !activeLiked;
      setLiked(prevLiked);
      syncGlobalPostCounts(qc, post.id, { respectDelta: prevLiked ? 1 : -1 });
      toast.error(
        err.message.includes("Unauthorized")
          ? "Sign in to like posts"
          : "Couldn't update like",
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["discovery-feed"] });
      qc.invalidateQueries({ queryKey: ["shorts-feed"] });
      qc.invalidateQueries({ queryKey: ["explore-feed"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["trainee-posts"] });
    },
  });

  const saveMut = useMutation({
    mutationFn: () => {
      if (!signedIn) {
        openAuthGate({ action: "save posts" });
        throw new Error("Unauthorized");
      }
      return saveFn({ data: { postId: post.id } });
    },
    onMutate: () => {
      const nextSaved = !activeSaved;
      setSaved(nextSaved);
      syncGlobalPostCounts(qc, post.id, { saveDelta: nextSaved ? 1 : -1 });
      qc.setQueryData<PostEngagement>(["post-engagement", post.id], (prev) => {
        const base: PostEngagement = prev ?? {
          respect: initialLiked,
          save: initialSaved,
          counts: {
            respect_count: post.respect_count,
            save_count: post.save_count,
            comment_count: post.comment_count ?? 0,
            share_count: 0,
          },
        };
        return {
          ...base,
          save: nextSaved,
          counts: {
            ...base.counts,
            save_count: Math.max(0, base.counts.save_count + (nextSaved ? 1 : -1)),
          },
        };
      });
    },
    onError: (err: Error) => {
      const prevSaved = !activeSaved;
      setSaved(prevSaved);
      syncGlobalPostCounts(qc, post.id, { saveDelta: prevSaved ? 1 : -1 });
      toast.error(
        err.message.includes("Unauthorized")
          ? "Sign in to save posts"
          : "Couldn't update save",
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["discovery-feed"] });
      qc.invalidateQueries({ queryKey: ["shorts-feed"] });
      qc.invalidateQueries({ queryKey: ["explore-feed"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["trainee-posts"] });
    },
  });

  const doubleTapLike = (x?: number, y?: number) => {
    // Cooldown: ignore repeated bursts within 450ms to prevent stacking / jank
    const now = Date.now();
    if (now - burstCooldownRef.current < 450) return;
    burstCooldownRef.current = now;
    const rect = mediaWrapRef.current?.getBoundingClientRect();
    const cx = rect && typeof x === "number" ? x - rect.left : (rect?.width ?? 0) / 2;
    const cy = rect && typeof y === "number" ? y - rect.top : (rect?.height ?? 0) / 2;
    const id = Date.now();
    setBurst({ x: cx, y: cy, id });
    setTimeout(() => {
      setBurst((b) => (b && b.id === id ? null : b));
    }, 950);
    // Haptic feedback where supported (Android Chrome, some others)
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([12, 40, 18]);
      } catch {
        /* no-op */
      }
    }
    if (!liked && !likeMut.isPending) likeMut.mutate();
  };

  // Movement threshold (px) above which a pointer down/up sequence is treated
  // as a scroll gesture, not a tap. Time threshold caps how "long" a tap can be.
  const TAP_MOVE_PX = 10;
  const TAP_MAX_MS = 500;
  const DBL_TAP_MS = 320;
  const DBL_TAP_PX = 40;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only handle primary button for mouse; ignore right/middle
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointerRef.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      type: e.pointerType,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pointerRef.current;
    if (!p || p.id !== e.pointerId) return;
    if (
      Math.abs(e.clientX - p.x) > TAP_MOVE_PX ||
      Math.abs(e.clientY - p.y) > TAP_MOVE_PX
    ) {
      p.moved = true;
    }
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pointerRef.current;
    if (p && p.id === e.pointerId) pointerRef.current = null;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pointerRef.current;
    pointerRef.current = null;
    if (!p || p.id !== e.pointerId) return;
    // Skip mouse — desktop uses onDoubleClick which is more reliable
    if (p.type === "mouse") return;
    // Discard if the finger moved (scroll) or the press was too long
    if (p.moved) return;
    if (performance.now() - p.t > TAP_MAX_MS) return;

    const now = performance.now();
    const last = lastTapRef.current;
    if (
      last &&
      now - last.t < DBL_TAP_MS &&
      Math.abs(e.clientX - last.x) < DBL_TAP_PX &&
      Math.abs(e.clientY - last.y) < DBL_TAP_PX
    ) {
      lastTapRef.current = null;
      if (signedIn) doubleTapLike(e.clientX, e.clientY);
      else openAuthGate({ action: "like posts" });
    } else {
      lastTapRef.current = { t: now, x: e.clientX, y: e.clientY };
    }
  };

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/posts/${post.id}`
      : `/posts/${post.id}`;
  const shareTitle = post.caption ?? "Check this post on LEER Sports";

  const caption = post.caption ?? "";
  const captionLong = caption.length > 140;

  return (
    <article
      ref={registerRef as never}
      tabIndex={-1}
      className="group/card w-full overflow-hidden rounded-2xl border border-border/50 bg-card/70 shadow-lg shadow-black/20 backdrop-blur transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
        <Link
          to="/trainers/$username"
          params={{ username: trainerHref }}
          aria-label={`View ${displayName}'s profile`}
          className="shrink-0"
          onClick={() => markPostAsSeen(post.id)}
        >
          <NewContentAvatarRing postId={post.id} createdAt={post.created_at}>
            <span className="relative flex h-9 w-9 overflow-hidden rounded-full border border-hairline bg-muted">
              {post.trainer.avatar_url ? (
                <img
                  src={post.trainer.avatar_url}
                  alt={displayName}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover object-center [aspect-ratio:1/1]"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary/40 to-accent/40" />
              )}
            </span>
          </NewContentAvatarRing>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link
              to="/trainers/$username"
              params={{ username: trainerHref }}
              className="truncate text-sm font-semibold text-foreground hover:opacity-80"
            >
              {handle ? `@${handle}` : displayName}
            </Link>
            {post.trainer.is_verified ? (
              <BadgeCheck
                className="h-3.5 w-3.5 shrink-0 text-primary"
                aria-label="Verified"
              />
            ) : null}
            <span className="text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              {formatRelative(post.created_at)}
            </span>
            <NewContentBadge postId={post.id} createdAt={post.created_at} />
          </div>
          {post.trainer.display_name && handle ? (
            <p className="truncate text-xs text-muted-foreground">
              {post.trainer.display_name}
            </p>
          ) : null}
        </div>
        {canFollow ? (
          <button
            type="button"
            onClick={onToggleFollow}
            disabled={followPending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all disabled:opacity-60",
              isFollowing
                ? "border border-border bg-transparent text-foreground hover:bg-muted"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {isFollowing ? (
              <>
                <UserCheck className="h-3.5 w-3.5" /> Following
              </>
            ) : (
              <>
                <UserPlus className="h-3.5 w-3.5" /> Follow
              </>
            )}
          </button>
        ) : null}
        {ownerMenu ?? (
          <button
            type="button"
            aria-label="More options"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}
      </header>

      {/* Media */}
      <div
        ref={mediaWrapRef}
        className="relative aspect-square w-full overflow-hidden bg-black"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{ touchAction: "pan-y" }}
      >
        {isVideo && media ? (
          <VideoPlayer
            src={media}
            poster={post.thumbnail_url ?? undefined}
            aspectRatio="1/1"
            muted
            controls
            className="h-full w-full rounded-none ring-0"
          />
        ) : thumb || post.media_url ? (
          <button
            type="button"
            onClick={handleMediaClick}
            className="block h-full w-full cursor-pointer focus:outline-none"
            aria-label="Open post"
          >
            <ResponsiveImage
              src={thumb || post.media_url || undefined}
              variant="thumb"
              seed={post.id}
              sizes="(min-width: 640px) 560px, 100vw"
              alt={post.caption ?? ""}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              className={cn(
                "h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-[1.02]",
                post.is_premium && !post.media_url && "locked-blur",
              )}
            />
          </button>
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/25 via-card to-accent/25" />
        )}

        {post.is_premium && !post.media_url ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <div className="relative flex items-center justify-center">
              <span className="absolute h-14 w-14 rounded-full border border-primary/50 bg-primary/20 animate-lock-ring" />
              <span className="absolute h-20 w-20 rounded-full border border-primary/30 bg-primary/10 animate-ping opacity-30" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-primary/60 bg-black/70 text-primary shadow-2xl backdrop-blur-md animate-lock-vibes">
                <Lock className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
              </div>
            </div>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-black/70 px-3.5 py-1 font-display text-[10px] uppercase tracking-[0.3em] text-primary shadow-lg backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Premium
            </span>
          </div>
        ) : post.is_premium ? (
          <span className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border border-primary/50 bg-black/70 px-2.5 py-0.5 font-display text-[9px] uppercase tracking-widest text-primary shadow-md backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Premium
          </span>
        ) : null}

        {/* Double-tap heart burst */}
        {burst ? (
          <div
            aria-hidden
            key={burst.id}
            className="pointer-events-none absolute z-20"
            style={{
              left: burst.x,
              top: burst.y,
              transform: "translate(-50%, -50%)",
              width: 0,
              height: 0,
            }}
          >
            {/* Expanding ring */}
            <span className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-primary/70 animate-heart-ring" />
            <span
              className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/40 animate-heart-ring"
              style={{ animationDelay: "80ms" }}
            />
            {/* Sparks */}
            {[
              { "--spark-transform": "translate(-90px,-70px)" },
              { "--spark-transform": "translate(90px,-70px)" },
              { "--spark-transform": "translate(-100px,60px)" },
              { "--spark-transform": "translate(100px,60px)" },
              { "--spark-transform": "translate(0,-110px)" },
              { "--spark-transform": "translate(0,110px)" },
            ].map((s, i) => (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary animate-heart-spark"
                style={s as React.CSSProperties}
              />
            ))}
            {/* Main heart */}
            <Heart
              className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 fill-primary text-primary animate-heart-burst"
              strokeWidth={1.5}
            />
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 px-2 pt-2 sm:gap-1 sm:px-3 sm:pt-3">
        <IconAction
          label={activeLiked ? "Unlike" : "Like"}
          onClick={() => !likeMut.isPending && likeMut.mutate()}
        >
          <Heart
            className={cn(
              "h-6 w-6 transition-transform",
              activeLiked ? "scale-110 fill-primary text-primary" : "text-foreground",
            )}
          />
        </IconAction>
        <IconAction label="Comment" onClick={onOpenComments}>
          <MessageCircle className="h-6 w-6 text-foreground" />
        </IconAction>
        <IconAction
          label="Share"
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.clipboard) {
              navigator.clipboard
                .writeText(shareUrl)
                .then(() => toast.success("Link copied to clipboard!"))
                .catch(() => {});
            }
            setShareOpen(true);
          }}
        >
          <Send className="h-6 w-6 -rotate-12 text-foreground" />
        </IconAction>
        <div className="flex-1" />
        <IconAction
          label={activeSaved ? "Unsave" : "Save"}
          onClick={() => !saveMut.isPending && saveMut.mutate()}
        >
          <Bookmark
            className={cn(
              "h-6 w-6 transition-transform",
              activeSaved ? "scale-110 fill-foreground text-foreground" : "text-foreground",
            )}
          />
        </IconAction>
      </div>

      {/* Meta */}
      <div className="space-y-1.5 px-3 pb-3 pt-1.5 sm:px-4 sm:pb-4 sm:pt-2">
        <p className="text-sm font-semibold text-foreground">
          {respectCount.toLocaleString()} {respectCount === 1 ? "like" : "likes"}
        </p>
        {caption ? (
          <p className="text-sm leading-snug text-foreground/90">
            {handle ? (
              <Link
                to="/trainers/$username"
                params={{ username: trainerHref }}
                className="mr-1.5 font-semibold text-foreground hover:opacity-80"
              >
                @{handle}
              </Link>
            ) : null}
            <span className={cn(!captionExpanded && captionLong && "line-clamp-2")}>
              {caption}
            </span>
            {captionLong && !captionExpanded ? (
              <button
                type="button"
                onClick={() => setCaptionExpanded(true)}
                className="ml-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                more
              </button>
            ) : null}
            <TranslateToggle text={caption} />
          </p>
        ) : null}
        {(post.comment_count ?? 0) > 0 ? (
          <button
            type="button"
            onClick={onOpenComments}
            className="block text-sm text-muted-foreground hover:text-foreground font-medium"
          >
            View all {post.comment_count} comments
          </button>
        ) : null}

        {/* Interactive Inline Comment Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!inlineCommentText.trim() || commentMut.isPending) return;
            commentMut.mutate(inlineCommentText.trim());
          }}
          className="mt-2 flex items-center gap-2 border-t border-border/40 pt-2.5"
        >
          <input
            type="text"
            value={inlineCommentText}
            onChange={(e) => setInlineCommentText(e.target.value)}
            placeholder="Add a comment…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {inlineCommentText.trim() ? (
            <button
              type="submit"
              disabled={commentMut.isPending}
              className="text-xs font-bold uppercase tracking-wider text-primary hover:text-primary/80 disabled:opacity-50"
            >
              {commentMut.isPending ? "Posting…" : "Post"}
            </button>
          ) : null}
        </form>

        <div className="flex items-center gap-2 pt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          {isVideo ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-semibold">
              <Share2 className="h-3 w-3" /> Reel
            </span>
          ) : null}
          <span>{saveCount.toLocaleString()} saves</span>
        </div>
      </div>

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={shareUrl}
        title={shareTitle}
        onShared={(channel) => {
          shareFn({ data: { postId: post.id, channel } }).catch(() => {});
        }}
      />
    </article>
  );
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full transition-transform hover:bg-muted/60 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(1, Math.floor(diff / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(d / 365)}y`;
}