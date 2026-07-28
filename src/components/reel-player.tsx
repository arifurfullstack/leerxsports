import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import { Bookmark, ChevronDown, ChevronUp, Heart, Maximize, MessageSquare, Minimize, Pause, Play, Share2, Volume2, VolumeX, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toggleRespect, toggleSave, getViewerEngagementBatch, logShare, syncGlobalPostCounts } from "@/lib/engagement-functions";
import { toggleFollow, getFollowingIds } from "@/lib/subscription-functions";
import { openAuthGate } from "@/lib/auth-gate";
import { ShareSheet } from "@/components/share-sheet";
import { ReelCommentsDrawer } from "@/components/reel-comments-drawer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";

export interface ReelItem {
  id: string;
  media_url: string;
  thumbnail_url: string | null;
  respect_count: number;
  comment_count: number;
  trainer: {
    user_id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function ReelPlayer({
  open,
  onOpenChange,
  reels,
  index,
  onIndexChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reels: ReelItem[];
  index: number;
  onIndexChange: (i: number) => void;
}) {
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [hoverProgress, setHoverProgress] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [authed, setAuthed] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [followPending, setFollowPending] = useState<Record<string, boolean>>({});
  const toggleRespectFn = useServerFn(toggleRespect);
  const toggleSaveFn = useServerFn(toggleSave);
  const getBatchFn = useServerFn(getViewerEngagementBatch);
  const logShareFn = useServerFn(logShare);
  const toggleFollowFn = useServerFn(toggleFollow);
  const getFollowingIdsFn = useServerFn(getFollowingIds);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const reel = reels[index];

  const next = useCallback(() => {
    if (index + 1 < reels.length) onIndexChange(index + 1);
    else onOpenChange(false);
  }, [index, reels.length, onIndexChange, onOpenChange]);

  const prev = useCallback(() => {
    if (index > 0) onIndexChange(index - 1);
  }, [index, onIndexChange]);

  const toggleFullscreen = useCallback(async () => {
    const el = stageRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {}
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Exit fullscreen when dialog closes
  useEffect(() => {
    if (!open && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [open]);

  // Auth + initial viewer engagement for visible reels
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const isAuthed = !!data.user;
      setAuthed(isAuthed);
      setMeId(data.user?.id ?? null);
      if (!isAuthed) return;
      const ids = reels.map((r) => r.id);
      if (!ids.length) return;
      try {
        const res = await getBatchFn({ data: { postIds: ids } });
        if (cancelled) return;
        setLiked((prev) => {
          const n = { ...prev };
          for (const id of res.liked) n[id] = true;
          return n;
        });
        setSaved((prev) => {
          const n = { ...prev };
          for (const id of res.saved) n[id] = true;
          return n;
        });
      } catch {}
      try {
        const followed = await getFollowingIdsFn();
        if (cancelled) return;
        const trainerIds = new Set(reels.map((r) => r.trainer.user_id));
        setFollowing((prev) => {
          const n = { ...prev };
          for (const id of followed) if (trainerIds.has(id)) n[id] = true;
          return n;
        });
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [open, reels, getBatchFn, getFollowingIdsFn]);

  // Reset playback per reel
  useEffect(() => {
    setPaused(false);
    setProgress(0);
    setDuration(0);
    setHoverProgress(null);
    const v = videoRef.current;
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
  }, [index, open]);

  // Play/pause sync
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause();
    else v.play().catch(() => {});
  }, [paused]);

  // Keyboard
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      else if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
      else if (e.key.toLowerCase() === "m") setMuted((m) => !m);
      else if (e.key.toLowerCase() === "f") { e.preventDefault(); void toggleFullscreen(); }
      else if (e.key.toLowerCase() === "s") { e.preventDefault(); setShareOpen(true); }
      else if (e.key === "ArrowRight" && e.shiftKey) { /* handled above */ }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, prev, toggleFullscreen]);

  if (!reel) return null;
  const nextReel = reels[index + 1];
  const prevReel = reels[index - 1];
  const displayName = reel.trainer.display_name || reel.trainer.username || "Creator";
  const handle = reel.trainer.username;
  const isLiked = !!liked[reel.id];
  const isSaved = !!saved[reel.id];
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/p/${reel.id}`
    : `/p/${reel.id}`;
  const shareTitle = `Reel by ${displayName} on LEER`;
  const likeCount = reel.respect_count;
  const trainerUserId = reel.trainer.user_id;
  const isOwnReel = !!meId && meId === trainerUserId;
  const isFollowing = !!following[trainerUserId];
  const isFollowPending = !!followPending[trainerUserId];

  const onFollow = async () => {
    if (!authed) {
      openAuthGate({ action: "follow creators" });
      return;
    }
    if (isOwnReel || isFollowPending) return;
    const nextVal = !isFollowing;
    setFollowing((prev) => ({ ...prev, [trainerUserId]: nextVal }));
    setFollowPending((prev) => ({ ...prev, [trainerUserId]: true }));
    try {
      const res = await toggleFollowFn({ data: { trainerId: trainerUserId } });
      setFollowing((prev) => ({ ...prev, [trainerUserId]: res.following }));
      qc.invalidateQueries({ queryKey: ["follow-counts", trainerUserId] });
      qc.invalidateQueries({ queryKey: ["subscription-info", trainerUserId] });
      if (meId) qc.invalidateQueries({ queryKey: ["follow-counts", meId] });
    } catch (err) {
      setFollowing((prev) => ({ ...prev, [trainerUserId]: !nextVal }));
      toast.error(err instanceof Error ? err.message : "Couldn't update follow");
    } finally {
      setFollowPending((prev) => ({ ...prev, [trainerUserId]: false }));
    }
  };

  const seekToRatio = (ratio: number) => {
    const v = videoRef.current;
    const clamped = Math.max(0, Math.min(1, ratio));
    setProgress(clamped);
    if (v && v.duration && Number.isFinite(v.duration)) {
      v.currentTime = clamped * v.duration;
    }
  };

  const ratioFromEvent = (clientX: number) => {
    const el = barRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return (clientX - rect.left) / rect.width;
  };

  const onScrubStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setScrubbing(true);
    videoRef.current?.pause();
    seekToRatio(ratioFromEvent(e.clientX));
  };
  const onScrubMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = ratioFromEvent(e.clientX);
    setHoverProgress(r);
    if (scrubbing) seekToRatio(r);
  };
  const onScrubEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbing) return;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    setScrubbing(false);
    if (!paused) videoRef.current?.play().catch(() => {});
  };

  const fmt = (s: number) => {
    if (!Number.isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r.toString().padStart(2, "0")}`;
  };
  const currentTime = (hoverProgress ?? progress) * duration;

  const onLike = async () => {
    if (!authed) { openAuthGate({ action: "like reels" }); return; }
    const id = reel.id;
    const nextLiked = !isLiked;
    setLiked((p) => ({ ...p, [id]: nextLiked }));
    syncGlobalPostCounts(qc, id, { respectDelta: nextLiked ? 1 : -1 });
    try {
      await toggleRespectFn({ data: { postId: id } });
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["shorts-feed"] });
      qc.invalidateQueries({ queryKey: ["explore-feed"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    } catch (e: any) {
      setLiked((p) => ({ ...p, [id]: !nextLiked }));
      syncGlobalPostCounts(qc, id, { respectDelta: nextLiked ? -1 : 1 });
      toast.error(e?.message ?? "Failed to update like");
    }
  };

  const onSave = async () => {
    if (!authed) { openAuthGate({ action: "save reels" }); return; }
    const id = reel.id;
    const nextSaved = !isSaved;
    setSaved((p) => ({ ...p, [id]: nextSaved }));
    syncGlobalPostCounts(qc, id, { saveDelta: nextSaved ? 1 : -1 });
    try {
      await toggleSaveFn({ data: { postId: id } });
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["shorts-feed"] });
      qc.invalidateQueries({ queryKey: ["explore-feed"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
      toast.success(nextSaved ? "Saved to bookmarks" : "Removed from bookmarks");
    } catch (e: any) {
      setSaved((p) => ({ ...p, [id]: !nextSaved }));
      syncGlobalPostCounts(qc, id, { saveDelta: nextSaved ? -1 : 1 });
      toast.error(e?.message ?? "Failed to save");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[440px] gap-0 overflow-hidden border-none bg-black p-0 sm:rounded-2xl"
        aria-label={`Reel by ${displayName}`}
      >
        <div
          ref={stageRef}
          className={cn(
            "relative w-full overflow-hidden bg-black",
            isFullscreen ? "flex h-screen w-screen items-center justify-center" : "aspect-[9/16]",
          )}
        >
          <video
            ref={videoRef}
            key={reel.id}
            src={reel.media_url}
            poster={reel.thumbnail_url ?? undefined}
            autoPlay
            playsInline
            loop={false}
            muted={muted}
            preload="metadata"
            onEnded={next}
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              if (Number.isFinite(d)) setDuration(d);
            }}
            onDurationChange={(e) => {
              const d = e.currentTarget.duration;
              if (Number.isFinite(d)) setDuration(d);
            }}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration && !scrubbing) setProgress(v.currentTime / v.duration);
            }}
            className={cn(
              "absolute inset-0 h-full w-full",
              isFullscreen ? "object-contain" : "object-cover",
            )}
            onClick={() => setPaused((p) => !p)}
          />

          {/* Top progress bar (scrubbable) */}
          <div
            role="slider"
            aria-label="Reel progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            onPointerDown={onScrubStart}
            onPointerMove={onScrubMove}
            onPointerUp={onScrubEnd}
            onPointerCancel={onScrubEnd}
            onPointerLeave={() => !scrubbing && setHoverProgress(null)}
            className="group absolute inset-x-3 top-2 z-30 flex h-5 cursor-pointer items-center touch-none select-none"
          >
            <div
              ref={barRef}
              className={cn(
                "relative w-full overflow-visible rounded-full bg-white/25 transition-[height]",
                scrubbing || hoverProgress !== null ? "h-1.5" : "h-0.5",
              )}
            >
              {hoverProgress !== null && (
                <div
                  className="absolute inset-y-0 rounded-full bg-white/40"
                  style={{ width: `${hoverProgress * 100}%` }}
                />
              )}
              <div
                className="absolute inset-y-0 rounded-full bg-white"
                style={{ width: `${progress * 100}%` }}
              />
              <div
                className={cn(
                  "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-opacity",
                  scrubbing ? "h-3.5 w-3.5 opacity-100" : "h-3 w-3 opacity-0 group-hover:opacity-100",
                )}
                style={{ left: `${progress * 100}%` }}
              />
            </div>
            {(scrubbing || hoverProgress !== null) && duration > 0 && (
              <div
                className="pointer-events-none absolute -top-6 -translate-x-1/2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white backdrop-blur"
                style={{ left: `${(hoverProgress ?? progress) * 100}%` }}
              >
                {fmt(currentTime)} / {fmt(duration)}
              </div>
            )}
          </div>

          {/* Top gradient + close */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black/70 to-transparent" />
          <div className="absolute right-2 top-3 z-30 flex items-center gap-1">
            <IconBtn label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)}>
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </IconBtn>
            <IconBtn label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </IconBtn>
            <IconBtn label="Close" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </IconBtn>
          </div>

          {/* Paused overlay */}
          {paused && (
            <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-black/50 text-white backdrop-blur">
                <Play className="ml-1 h-8 w-8 fill-current" />
              </span>
            </div>
          )}

          {/* Bottom info */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4">
            <div className="pointer-events-auto flex items-end justify-between gap-3">
              <Link
                to={handle ? "/u/$username" : "/explore"}
                params={handle ? { username: handle } : undefined}
                onClick={() => onOpenChange(false)}
                className="flex min-w-0 items-center gap-2"
              >
                <UserAvatar src={reel.trainer.avatar_url} name={displayName} size="sm" className="h-8 w-8 ring-2 ring-white/25" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{displayName}</p>
                  {handle && <p className="truncate text-[11px] text-white/70">@{handle}</p>}
                </div>
              </Link>
              {!isOwnReel && (
                <button
                  type="button"
                  onClick={onFollow}
                  aria-pressed={isFollowing}
                  aria-label={isFollowing ? `Unfollow ${displayName}` : `Follow ${displayName}`}
                  disabled={isFollowPending}
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide backdrop-blur transition active:scale-95",
                    isFollowing
                      ? "bg-white/10 text-white hover:bg-white/20"
                      : "bg-primary text-primary-foreground hover:brightness-110",
                    isFollowPending && "opacity-60",
                  )}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
              )}
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-white">
                <button
                  type="button"
                  aria-label={isLiked ? "Remove like" : "Like reel"}
                  aria-pressed={isLiked}
                  onClick={onLike}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1.5 backdrop-blur transition hover:bg-black/60 active:scale-95",
                    isLiked && "text-primary",
                  )}
                >
                  <Heart className={cn("h-3.5 w-3.5 transition", isLiked && "fill-current")} />
                  <span className="tabular-nums">{likeCount}</span>
                </button>
                <button
                  type="button"
                  aria-label="Open comments"
                  onClick={() => {
                    setPaused(true);
                    setCommentsOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1.5 backdrop-blur transition hover:bg-black/60 active:scale-95"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="tabular-nums">
                    {reel.comment_count}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={isSaved ? "Remove bookmark" : "Save reel"}
                  aria-pressed={isSaved}
                  onClick={onSave}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1.5 backdrop-blur transition hover:bg-black/60 active:scale-95",
                    isSaved && "text-primary",
                  )}
                >
                  <Bookmark className={cn("h-3.5 w-3.5 transition", isSaved && "fill-current")} />
                </button>
                <button
                  type="button"
                  aria-label="Share reel"
                  onClick={() => setShareOpen(true)}
                  className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1.5 backdrop-blur transition hover:bg-black/60 active:scale-95"
                >
                  <Share2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Side controls (desktop) */}
          <button type="button" aria-label="Previous reel" onClick={prev}
            className="absolute -left-12 top-1/2 z-30 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur hover:bg-white/20 sm:block">
            <ChevronUp className="h-5 w-5" />
          </button>
          <button type="button" aria-label="Next reel" onClick={next}
            className="absolute -right-12 top-1/2 z-30 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur hover:bg-white/20 sm:block">
            <ChevronDown className="h-5 w-5" />
          </button>

          {/* Play/Pause toggle button (mobile-friendly, top-left) */}
          <div className="absolute left-2 top-3 z-30">
            <IconBtn label={paused ? "Play" : "Pause"} onClick={() => setPaused((p) => !p)}>
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </IconBtn>
          </div>
        </div>
      </DialogContent>
      {/* Preload adjacent reels for instant transitions */}
      {open && nextReel && (
        <video
          key={`preload-next-${nextReel.id}`}
          src={nextReel.media_url}
          poster={nextReel.thumbnail_url ?? undefined}
          preload="auto"
          muted
          playsInline
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none fixed h-px w-px opacity-0"
          style={{ left: -9999, top: -9999 }}
        />
      )}
      {open && prevReel && (
        <video
          key={`preload-prev-${prevReel.id}`}
          src={prevReel.media_url}
          poster={prevReel.thumbnail_url ?? undefined}
          preload="metadata"
          muted
          playsInline
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none fixed h-px w-px opacity-0"
          style={{ left: -9999, top: -9999 }}
        />
      )}
      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={shareUrl}
        title={shareTitle}
        description="Watch this reel on LEER"
        onShared={(channel) => {
          if (authed) {
            logShareFn({ data: { postId: reel.id, channel } }).catch(() => {});
          }
        }}
      />
      <ReelCommentsDrawer
        open={commentsOpen}
        onOpenChange={(o) => {
          setCommentsOpen(o);
          if (!o) {
            setPaused(false);
            qc.invalidateQueries({ queryKey: ["home"] });
            qc.invalidateQueries({ queryKey: ["shorts-feed"] });
            qc.invalidateQueries({ queryKey: ["explore-feed"] });
            qc.invalidateQueries({ queryKey: ["feed"] });
          }
        }}
        postId={reel?.id ?? null}
        onCountChange={(id, delta) =>
          syncGlobalPostCounts(qc, id, { commentDelta: delta })
        }
      />
    </Dialog>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white/95 backdrop-blur transition hover:bg-black/60"
    >
      {children}
    </button>
  );
}
