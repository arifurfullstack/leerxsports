import { createFileRoute, Link } from "@tanstack/react-router";
import {
  queryOptions,
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  useQuery,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Heart,
  Bookmark,
  Send,
  Lock,
  ChevronUp,
  ChevronDown,
  MessageCircle,
  MoreHorizontal,
  Play,
  Volume2,
  VolumeX,
  Music2,
  UserPlus,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { getShortsFeed, type DiscoveryPost } from "@/lib/trainer-functions";
import {
  toggleRespect,
  toggleSave,
  logShare,
  getViewerEngagementBatch,
  syncGlobalPostCounts,
} from "@/lib/engagement-functions";
import { toggleFollow, getFollowingIds } from "@/lib/subscription-functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ShareSheet } from "@/components/share-sheet";
import { PostDetailDialog } from "@/components/post-detail-dialog";
import { openAuthGate } from "@/lib/auth-gate";
import { Button } from "@/components/ui/button";

const shortsQuery = queryOptions({
  queryKey: ["shorts-feed"],
  queryFn: () => getShortsFeed(),
});

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  if (n < 1_000_000) return Math.round(n / 1000) + "K";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}

export const Route = createFileRoute("/shorts")({
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(shortsQuery);
    } catch (e) {
      console.error("Shorts loader error:", e);
    }
  },
  head: () => ({
    meta: [
      { title: "Shorts — LEER Sports" },
      {
        name: "description",
        content: "Vertical fitness shorts from verified elite creators.",
      },
      { property: "og:title", content: "Shorts — LEER Sports" },
      {
        property: "og:description",
        content: "Vertical fitness shorts from verified elite creators.",
      },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShortsPage,
  errorComponent: ({ error }) => {
    const isHtml = error.message?.includes("<html") || error.message?.includes("<!doctype");
    const cleanMsg = isHtml
      ? "Unable to load shorts feed. Please check your connection."
      : error.message || "An unexpected error occurred.";
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">
          Could not load shorts
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{cleanMsg}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => window.location.reload()} className="font-bold bg-primary text-primary-foreground">
            Try Again
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Go Home</Link>
          </Button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function ShortsPage() {
  const { data: shortsData } = useQuery(shortsQuery);
  const shorts = shortsData ?? [];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const signedIn = !!userId;

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Viewer engagement (liked/saved sets)
  const postIds = useMemo(() => shorts.map((s) => s.id), [shorts]);
  const { data: engagement } = useQuery({
    queryKey: ["shorts-engagement", userId, postIds.length],
    queryFn: () =>
      signedIn
        ? getViewerEngagementBatch({ data: { postIds } })
        : Promise.resolve({ liked: [], saved: [] }),
    enabled: signedIn && postIds.length > 0,
  });
  const likedSet = useMemo(
    () => new Set(engagement?.liked ?? []),
    [engagement],
  );
  const savedSet = useMemo(
    () => new Set(engagement?.saved ?? []),
    [engagement],
  );

  // Following set for follow buttons
  const { data: following } = useQuery({
    queryKey: ["following-ids", userId],
    queryFn: () => getFollowingIds(),
    enabled: signedIn,
  });
  const followingSet = useMemo(
    () => new Set(following ?? []),
    [following],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = entry.target.querySelector("video");
          const idx = Number((entry.target as HTMLElement).dataset.index);
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            setActiveIndex(idx);
            if (video) video.play().catch(() => {});
          } else if (video) {
            video.pause();
            // Reset offscreen video to start so returning feels instant
            if (entry.intersectionRatio === 0) {
              try {
                video.currentTime = 0;
              } catch {
                /* noop */
              }
            }
          }
        }
      },
      {
        root: container,
        // Center-bias: only mark active when the slide fills the center band
        rootMargin: "-20% 0px -20% 0px",
        threshold: [0, 0.6, 1],
      },
    );
    container.querySelectorAll("[data-short]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [shorts.length]);

  const scrollByStep = useCallback((dir: 1 | -1) => {
    const container = containerRef.current;
    if (!container) return;
    const height = container.clientHeight;
    container.scrollBy({ top: dir * height, behavior: "smooth" });
  }, []);

  // Keyboard navigation: ArrowUp/Down, J/K, Space to toggle mute
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowDown" || e.key === "j" || e.key === "J") {
        e.preventDefault();
        scrollByStep(1);
      } else if (e.key === "ArrowUp" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        scrollByStep(-1);
      } else if (e.key === "m" || e.key === "M") {
        setMuted((m) => !m);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scrollByStep]);

  if (shorts.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-black p-8">
        <p className="text-white/60">No reels yet.</p>
      </div>
    );
  }

  return (
    <div className="relative bg-black">
      <div
        ref={containerRef}
        className="h-[calc(100dvh-4rem)] snap-y snap-mandatory overflow-y-auto overscroll-y-contain scrollbar-none [-webkit-overflow-scrolling:touch] [scroll-behavior:smooth]"
        style={{ scrollbarWidth: "none" }}
      >
        {shorts.map((p, i) => (
          <ShortSlide
            key={p.id}
            post={p}
            index={i}
            activeIndex={activeIndex}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            signedIn={signedIn}
            currentUserId={userId}
            initialLiked={likedSet.has(p.id)}
            initialSaved={savedSet.has(p.id)}
            isFollowing={followingSet.has(p.trainer.user_id)}
            isSelf={userId === p.trainer.user_id}
          />
        ))}
      </div>

      {/* Desktop arrow controls */}
      <div className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 flex-col gap-3 md:flex">
        <button
          type="button"
          onClick={() => scrollByStep(-1)}
          disabled={activeIndex === 0}
          className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/5 text-white backdrop-blur-md transition-colors hover:bg-white/15 disabled:opacity-30"
          aria-label="Previous reel"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => scrollByStep(1)}
          disabled={activeIndex === shorts.length - 1}
          className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/5 text-white backdrop-blur-md transition-colors hover:bg-white/15 disabled:opacity-30"
          aria-label="Next reel"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function ShortSlide({
  post,
  index,
  activeIndex,
  muted,
  onToggleMute,
  signedIn,
  currentUserId,
  initialLiked,
  initialSaved,
  isFollowing,
  isSelf,
}: {
  post: DiscoveryPost;
  index: number;
  activeIndex: number;
  muted: boolean;
  onToggleMute: () => void;
  signedIn: boolean;
  currentUserId: string | null;
  initialLiked: boolean;
  initialSaved: boolean;
  isFollowing: boolean;
  isSelf: boolean;
}) {
  const qc = useQueryClient();
  const respectFn = useServerFn(toggleRespect);
  const saveFn = useServerFn(toggleSave);
  const shareFn = useServerFn(logShare);
  const followFn = useServerFn(toggleFollow);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const trainerHref = post.trainer.username ?? post.trainer.user_id;

  const [liked, setLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(initialSaved);
  const [following, setFollowing] = useState(isFollowing);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [burst, setBurst] = useState<{ x: number; y: number; id: number } | null>(null);
  const burstCooldownRef = useRef<number>(0);
  const [showUnmuteHint, setShowUnmuteHint] = useState(false);

  useEffect(() => setLiked(initialLiked), [initialLiked]);
  useEffect(() => setSaved(initialSaved), [initialSaved]);
  useEffect(() => setFollowing(isFollowing), [isFollowing]);

  const respectCount = post.respect_count;
  const saveCount = post.save_count;
  const commentCount = post.comment_count ?? 0;

  // Sync muted prop
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    if (!muted) {
      setShowUnmuteHint(false);
    }
  }, [muted]);

  // Video events → progress + paused state + unmute hint
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      if (v.duration) setProgress(v.currentTime / v.duration);
    };
    const onPlay = () => setPaused(false);
    const onPause = () => setPaused(true);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, []);

  useEffect(() => {
    if (muted) {
      const t = setTimeout(() => setShowUnmuteHint(true), 800);
      return () => clearTimeout(t);
    }
  }, [muted]);

  // ---- Mutations ----
  const likeMut = useMutation({
    mutationFn: () => {
      if (!signedIn) {
        openAuthGate({ action: "like reels" });
        throw new Error("Unauthorized");
      }
      return respectFn({ data: { postId: post.id } });
    },
    onMutate: () => {
      const next = !liked;
      setLiked(next);
      syncGlobalPostCounts(qc, post.id, { respectDelta: next ? 1 : -1 });
      return { next };
    },
    onError: (err: Error, _variables, context) => {
      setLiked((v) => !v);
      if (context) {
        syncGlobalPostCounts(qc, post.id, {
          respectDelta: context.next ? -1 : 1,
        });
      }
      if (!err.message.includes("Unauthorized")) toast.error("Couldn't update like");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shorts-engagement"] });
      qc.invalidateQueries({ queryKey: ["shorts-feed"] });
    },
  });

  const saveMut = useMutation({
    mutationFn: () => {
      if (!signedIn) {
        openAuthGate({ action: "save reels" });
        throw new Error("Unauthorized");
      }
      return saveFn({ data: { postId: post.id } });
    },
    onMutate: () => {
      const next = !saved;
      setSaved(next);
      syncGlobalPostCounts(qc, post.id, { saveDelta: next ? 1 : -1 });
      return { next };
    },
    onError: (err: Error, _variables, context) => {
      setSaved((v) => !v);
      if (context) {
        syncGlobalPostCounts(qc, post.id, {
          saveDelta: context.next ? -1 : 1,
        });
      }
      if (!err.message.includes("Unauthorized")) toast.error("Couldn't update save");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shorts-engagement"] });
      qc.invalidateQueries({ queryKey: ["shorts-feed"] });
    },
  });

  const followMut = useMutation({
    mutationFn: () => {
      if (!signedIn) {
        openAuthGate({ action: "follow creators" });
        throw new Error("Unauthorized");
      }
      return followFn({ data: { trainerUserId: post.trainer.user_id } });
    },
    onMutate: () => setFollowing((v) => !v),
    onError: (err: Error) => {
      setFollowing((v) => !v);
      if (!err.message.includes("Unauthorized")) toast.error("Couldn't update follow");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["following-ids"] }),
  });

  // ---- Double-tap like with pointer events ----
  const TAP_MOVE_PX = 10;
  const TAP_MAX_MS = 500;
  const DBL_TAP_MS = 320;
  const DBL_TAP_PX = 40;
  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const pointerRef = useRef<{
    id: number;
    x: number;
    y: number;
    t: number;
    type: string;
    moved: boolean;
  } | null>(null);

  const triggerLikeBurst = useCallback(
    (clientX?: number, clientY?: number) => {
      const now = Date.now();
      if (now - burstCooldownRef.current < 450) return;
      burstCooldownRef.current = now;
      const rect = mediaRef.current?.getBoundingClientRect();
      const cx =
        rect && typeof clientX === "number"
          ? clientX - rect.left
          : (rect?.width ?? 0) / 2;
      const cy =
        rect && typeof clientY === "number"
          ? clientY - rect.top
          : (rect?.height ?? 0) / 2;
      const id = Date.now();
      setBurst({ x: cx, y: cy, id });
      setTimeout(() => setBurst((b) => (b && b.id === id ? null : b)), 950);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate([12, 40, 18]);
        } catch {
          /* noop */
        }
      }
      if (!liked && !likeMut.isPending) likeMut.mutate();
    },
    [liked, likeMut],
  );

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
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
    if (p.moved) return;
    if (performance.now() - p.t > TAP_MAX_MS) return;
    // Desktop: single click toggles play/pause; ignore here (handled by onClick fallback)
    if (p.type === "mouse") return;

    const now = performance.now();
    const last = lastTapRef.current;
    if (
      last &&
      now - last.t < DBL_TAP_MS &&
      Math.abs(e.clientX - last.x) < DBL_TAP_PX &&
      Math.abs(e.clientY - last.y) < DBL_TAP_PX
    ) {
      lastTapRef.current = null;
      triggerLikeBurst(e.clientX, e.clientY);
    } else {
      lastTapRef.current = { t: now, x: e.clientX, y: e.clientY };
      // Delay play/pause toggle to give room for a second tap
      const tapTs = now;
      setTimeout(() => {
        if (lastTapRef.current && lastTapRef.current.t === tapTs) {
          lastTapRef.current = null;
          togglePlay();
        }
      }, DBL_TAP_MS);
    }
  };

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/posts/${post.id}`
      : `/posts/${post.id}`;
  const shareTitle = post.caption ?? "Watch on LEER Reels";

  const canFollow = signedIn && !isSelf;
  const caption = post.caption ?? "";
  const captionLong = caption.length > 90;

  // Preload window: active slide = auto, neighbors = metadata, rest = none.
  // Keeps memory low on long feeds while making the next reel feel instant.
  const distance = Math.abs(index - activeIndex);
  const preloadAttr: "auto" | "metadata" | "none" =
    distance === 0 ? "auto" : distance === 1 ? "metadata" : "none";
  // Skip render/paint work for slides far from the viewport.
  const offscreenFar = distance > 2;

  return (
    <section
      data-short
      data-index={index}
      className="relative flex h-[calc(100dvh-4rem)] snap-start snap-always items-center justify-center [contain:layout_paint_size]"
      style={
        offscreenFar
          ? { contentVisibility: "auto", containIntrinsicSize: "100dvh 100vw" }
          : undefined
      }
    >
      <div
        ref={mediaRef}
        className="relative aspect-[9/16] h-full max-h-[calc(100dvh-4rem)] w-full overflow-hidden bg-neutral-950 sm:h-[min(100%,860px)] sm:w-auto sm:rounded-xl"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onDoubleClick={(e) => {
          e.preventDefault();
          triggerLikeBurst(e.clientX, e.clientY);
        }}
        onClick={(e) => {
          // Desktop single click toggles play/pause; ignore if double-click handler fired
          if ((e.detail ?? 1) > 1) return;
          togglePlay();
        }}
        style={{ touchAction: "pan-y" }}
      >
        {post.is_premium ? (
          <div className="relative h-full w-full">
            {post.thumbnail_url && (
              <img
                src={post.thumbnail_url}
                alt=""
                className={cn("h-full w-full object-cover", "locked-blur")}
              />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 text-center">
              <div className="rounded-full border border-primary/50 bg-black/50 p-3">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <span className="font-display text-xs uppercase tracking-[0.3em] text-white">
                Premium Reel
              </span>
              <Link
                to="/trainers/$username"
                params={{ username: trainerHref }}
                className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary-foreground hover:bg-primary/90"
              >
                Subscribe to watch
              </Link>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={post.media_url}
            poster={post.thumbnail_url ?? undefined}
            playsInline
            loop
            muted={muted}
            preload={preloadAttr}
            className="h-full w-full object-cover"
          />
        )}

        {/* Vignette gradient (bottom + top) */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />

        {/* Big play glyph when paused */}
        {paused && !post.is_premium ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="grid h-20 w-20 place-items-center rounded-full bg-black/50 backdrop-blur-md animate-scale-in">
              <Play className="h-8 w-8 fill-white text-white" />
            </span>
          </div>
        ) : null}

        {/* Unmute hint pill */}
        {muted && !post.is_premium && showUnmuteHint ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
            className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white backdrop-blur"
          >
            <VolumeX className="h-3 w-3" /> Tap to unmute
          </button>
        ) : null}

        {/* Reels label top-left */}
        <div className="absolute left-3 top-3 z-10 font-display text-sm font-bold uppercase tracking-[0.3em] text-white/90 drop-shadow">
          Reels
        </div>

        {/* Action rail (right) */}
        <ActionRail
          post={post}
          liked={liked}
          saved={saved}
          respectCount={respectCount}
          saveCount={saveCount}
          commentCount={commentCount}
          onLike={(e) => {
            e.stopPropagation();
            if (!likeMut.isPending) likeMut.mutate();
          }}
          onComments={(e) => {
            e.stopPropagation();
            setCommentOpen(true);
          }}
          onSave={(e) => {
            e.stopPropagation();
            if (!saveMut.isPending) saveMut.mutate();
          }}
          onShare={(e) => {
            e.stopPropagation();
            setShareOpen(true);
          }}
          onToggleMute={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          muted={muted}
        />

        {/* Bottom info */}
        <div
          className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 px-4 pb-6 pr-20 text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2.5">
            <Link
              to="/trainers/$username"
              params={{ username: trainerHref }}
              className="flex min-w-0 items-center gap-2"
            >
              <span className="relative shrink-0">
                <span className="absolute -inset-[2px] rounded-full bg-gradient-to-tr from-primary via-accent to-primary" />
                <span className="relative block h-9 w-9 overflow-hidden rounded-full ring-2 ring-black">
                  {post.trainer.avatar_url ? (
                    <img
                      src={post.trainer.avatar_url}
                      alt=""
                      width={36}
                      height={36}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover object-center [aspect-ratio:1/1]"
                    />
                  ) : (
                    <span className="block h-full w-full bg-gradient-to-br from-primary/40 to-accent/40" />
                  )}
                </span>
              </span>
              <span className="min-w-0 truncate text-sm font-semibold">
                {post.trainer.username ? `@${post.trainer.username}` : post.trainer.display_name}
              </span>
              {post.trainer.is_verified && (
                <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Verified" />
              )}
            </Link>
            {canFollow ? (
              <button
                type="button"
                onClick={() => !followMut.isPending && followMut.mutate()}
                disabled={followMut.isPending}
                className={cn(
                  "ml-1 inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest transition-colors disabled:opacity-60",
                  following
                    ? "border-white/40 bg-transparent text-white/90 hover:bg-white/10"
                    : "border-white bg-transparent text-white hover:bg-white hover:text-black",
                )}
              >
                {following ? (
                  <>
                    <UserCheck className="h-3 w-3" /> Following
                  </>
                ) : (
                  <>
                    <UserPlus className="h-3 w-3" /> Follow
                  </>
                )}
              </button>
            ) : null}
          </div>

          {caption ? (
            <div className="text-[13px] leading-snug text-white/95">
              <p className={cn(captionExpanded ? "" : "line-clamp-2")}>{caption}</p>
              {captionLong ? (
                <button
                  type="button"
                  onClick={() => setCaptionExpanded((v) => !v)}
                  className="text-[11px] font-semibold uppercase tracking-widest text-white/70 hover:text-white"
                >
                  {captionExpanded ? "Show less" : "More"}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center gap-2 text-[11px] text-white/80">
            <Music2 className="h-3.5 w-3.5" />
            <span className="truncate">
              Original audio · {post.trainer.display_name ?? post.trainer.username ?? "creator"}
            </span>
          </div>
        </div>

        {/* Timeline scrubber */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-0.5 bg-white/15">
          <div
            className="h-full bg-white transition-[width] duration-100"
            style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
          />
        </div>

        {/* Double-tap heart burst */}
        {burst ? (
          <div
            aria-hidden
            key={burst.id}
            className="pointer-events-none absolute z-30"
            style={{
              left: burst.x,
              top: burst.y,
              transform: "translate(-50%, -50%)",
              width: 0,
              height: 0,
            }}
          >
            <span className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-primary/70 animate-heart-ring" />
            <span
              className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/40 animate-heart-ring"
              style={{ animationDelay: "80ms" }}
            />
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
            <Heart
              className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 fill-primary text-primary animate-heart-burst"
              strokeWidth={1.5}
            />
          </div>
        ) : null}
      </div>

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={shareUrl}
        title={shareTitle}
        description={post.caption ?? undefined}
        onShared={(channel) => {
          shareFn({ data: { postId: post.id, channel } }).catch(() => {});
        }}
      />

      <PostDetailDialog
        post={post as any}
        open={commentOpen}
        panel="comments"
        onOpenChange={setCommentOpen}
        currentUserId={currentUserId}
        isSignedIn={signedIn}
      />
    </section>
  );
}

function ActionRail({
  post,
  liked,
  saved,
  respectCount,
  saveCount,
  commentCount,
  muted,
  onLike,
  onComments,
  onSave,
  onShare,
  onToggleMute,
}: {
  post: DiscoveryPost;
  liked: boolean;
  saved: boolean;
  respectCount: number;
  saveCount: number;
  commentCount: number;
  muted: boolean;
  onLike: (e: React.MouseEvent) => void;
  onComments: (e: React.MouseEvent) => void;
  onSave: (e: React.MouseEvent) => void;
  onShare: (e: React.MouseEvent) => void;
  onToggleMute: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="absolute bottom-24 right-2 z-20 flex flex-col items-center gap-4 text-white sm:right-3">
      <RailButton label={formatCount(respectCount)} onClick={onLike} active={liked} activeColor>
        <Heart
          className={cn(
            "h-7 w-7 transition-transform",
            liked ? "scale-110 fill-primary text-primary" : "text-white",
          )}
          strokeWidth={liked ? 2 : 1.8}
        />
      </RailButton>
      <RailButton label={formatCount(commentCount)} onClick={onComments}>
        <MessageCircle className="h-7 w-7" strokeWidth={1.8} />
      </RailButton>
      <RailButton label="Share" onClick={onShare}>
        <Send className="h-7 w-7 -rotate-12" strokeWidth={1.8} />
      </RailButton>
      <RailButton label={formatCount(saveCount)} onClick={onSave}>
        <Bookmark
          className={cn(
            "h-7 w-7 transition-transform",
            saved ? "scale-110 fill-white text-white" : "text-white",
          )}
          strokeWidth={1.8}
        />
      </RailButton>
      <RailButton label={muted ? "Muted" : "Sound"} onClick={onToggleMute}>
        {muted ? (
          <VolumeX className="h-6 w-6" strokeWidth={1.8} />
        ) : (
          <Volume2 className="h-6 w-6" strokeWidth={1.8} />
        )}
      </RailButton>
      <button
        type="button"
        aria-label="More"
        className="grid h-8 w-8 place-items-center rounded-full text-white/90 hover:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      {/* Spinning audio disc */}
      <div className="mt-1 grid h-9 w-9 place-items-center rounded-full border border-white/30 bg-black/60">
        <span
          className="block h-3 w-3 rounded-full bg-white/90"
          style={{ animation: "spin 6s linear infinite" }}
        />
      </div>
    </div>
  );
}

function RailButton({
  children,
  label,
  onClick,
  active,
  activeColor,
}: {
  children: React.ReactNode;
  label: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  active?: boolean;
  activeColor?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 text-white/95 transition-transform active:scale-90"
    >
      <span className="grid place-items-center drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
        {children}
      </span>
      <span
        className={cn(
          "text-[11px] font-semibold tabular-nums drop-shadow",
          active && activeColor ? "text-primary" : "text-white",
        )}
      >
        {label}
      </span>
    </button>
  );
}
