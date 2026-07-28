import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import { SmartImage } from "@/components/smart-image";
import { ChevronLeft, ChevronRight, Pause, Play, X, Volume2, VolumeX, Trash2, Heart } from "lucide-react";
import { Link } from "@tanstack/react-router";

export interface StoryPerson {
  user_id: string;
  name: string;
  handle: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  is_verified?: boolean;
}

export interface StorySlide {
  id: string;
  url: string;
  kind: "image" | "video";
  caption?: string | null;
  createdAtLabel?: string;
  like_count?: number;
  liked_by_me?: boolean;
}

export interface StoryReel {
  person: StoryPerson;
  slides: StorySlide[];
}

const SLIDE_MS = 5000;

export function StoryViewer({
  open,
  onOpenChange,
  reels,
  index,
  onIndexChange,
  onSlideView,
  canDeleteSlide,
  onDeleteSlide,
  onToggleLike,
  initialSlideId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reels: StoryReel[];
  index: number;
  onIndexChange: (i: number) => void;
  onSlideView?: (slideId: string) => void;
  canDeleteSlide?: (slideId: string) => boolean;
  onDeleteSlide?: (slideId: string) => void | Promise<void>;
  onToggleLike?: (slideId: string, nextLiked: boolean) => void | Promise<void>;
  initialSlideId?: string | null;
}) {
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const accRef = useRef<number>(0);

  const reel = reels[index];
  const slidesCount = reel?.slides.length ?? 0;
  const current = reel?.slides[slide];

  // Local optimistic like state keyed by slide id so counters feel instant.
  const [likeOverrides, setLikeOverrides] = useState<
    Record<string, { liked: boolean; count: number }>
  >({});
  const likedNow = current
    ? likeOverrides[current.id]?.liked ?? !!current.liked_by_me
    : false;
  const likeCountNow = current
    ? likeOverrides[current.id]?.count ?? current.like_count ?? 0
    : 0;

  const toggleLike = useCallback(() => {
    if (!current || !onToggleLike) return;
    const next = !likedNow;
    setLikeOverrides((prev) => ({
      ...prev,
      [current.id]: {
        liked: next,
        count: Math.max(0, likeCountNow + (next ? 1 : -1)),
      },
    }));
    Promise.resolve(onToggleLike(current.id, next)).catch(() => {
      // Roll back on failure.
      setLikeOverrides((prev) => ({
        ...prev,
        [current.id]: { liked: !next, count: likeCountNow },
      }));
    });
  }, [current, onToggleLike, likedNow, likeCountNow]);

  const currentReelId = reels[index]?.person.user_id;
  const prevReelIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      prevReelIdRef.current = null;
      return;
    }
    if (prevReelIdRef.current !== currentReelId) {
      prevReelIdRef.current = currentReelId ?? null;
      const reelNow = reels[index];
      let startAt = 0;
      if (initialSlideId && reelNow) {
        const found = reelNow.slides.findIndex((s) => s.id === initialSlideId);
        if (found >= 0) startAt = found;
      }
      setSlide(startAt);
      accRef.current = 0;
      setProgress(0);
    }
  }, [index, open, initialSlideId, currentReelId, reels]);

  // Notify parent whenever a slide becomes visible so it can record a view.
  useEffect(() => {
    if (!open || !current || !onSlideView) return;
    onSlideView(current.id);
  }, [open, current, onSlideView]);

  const goNextReel = useCallback(() => {
    if (index + 1 < reels.length) onIndexChange(index + 1);
    else onOpenChange(false);
  }, [index, reels.length, onIndexChange, onOpenChange]);

  const goPrevReel = useCallback(() => {
    if (index > 0) onIndexChange(index - 1);
  }, [index, onIndexChange]);

  const nextSlide = useCallback(() => {
    if (!reel) return;
    if (slide + 1 < slidesCount) {
      setSlide(slide + 1);
      accRef.current = 0;
      setProgress(0);
    } else goNextReel();
  }, [reel, slide, slidesCount, goNextReel]);

  const prevSlide = useCallback(() => {
    accRef.current = 0;
    setProgress(0);
    if (slide > 0) setSlide(slide - 1);
    else goPrevReel();
  }, [slide, goPrevReel]);

  useEffect(() => {
    if (!open || !reel || !current) return;

    accRef.current = 0;
    setProgress(0);
    let animationFrameId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;

      if (!paused) {
        accRef.current += delta;
        const pct = Math.min(1, accRef.current / SLIDE_MS);
        setProgress(pct);

        if (pct >= 1) {
          nextSlide();
          return;
        }
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [open, current?.id, paused, nextSlide]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); nextSlide(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prevSlide(); }
      else if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
      else if (e.key === "Escape") { onOpenChange(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, nextSlide, prevSlide, onOpenChange]);

  if (!open || !reel || !current) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[440px] gap-0 overflow-hidden border-none bg-black p-0 shadow-2xl sm:rounded-2xl"
        aria-label={reel ? `Stories by ${reel.person.name}` : "Stories"}
      >
        {reel && current && (
          <div className="relative flex aspect-[9/16] w-full flex-col overflow-hidden bg-black">
            <div className="absolute inset-0 bg-black">
              {current.kind === "video" ? (
                <video
                  key={current.id}
                  src={current.url}
                  autoPlay
                  playsInline
                  muted={muted}
                  className="h-full w-full object-cover"
                  onEnded={nextSlide}
                />
              ) : (
                <img
                  key={current.id}
                  src={current.url}
                  alt={current.caption || "Story slide"}
                  className="h-full w-full object-cover"
                />
              )}
            </div>

            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-black/70 to-transparent" />

            <div className="relative z-20 flex gap-1 px-3 pt-2">
              {reel.slides.map((s, i) => {
                const pct = i < slide ? 1 : i === slide ? progress : 0;
                return (
                  <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
                    <div className="h-full rounded-full bg-white" style={{ width: `${pct * 100}%` }} />
                  </div>
                );
              })}
            </div>

            <div className="relative z-20 flex items-center gap-2 px-3 pt-3">
              <Link
                to={reel.person.handle ? "/u/$username" : "/explore"}
                params={reel.person.handle ? { username: reel.person.handle } : undefined}
                onClick={() => onOpenChange(false)}
                className="flex min-w-0 items-center gap-2"
              >
                <UserAvatar
                  src={reel.person.avatar_url}
                  name={reel.person.name}
                  size="sm"
                  className="h-8 w-8 ring-2 ring-white/20"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{reel.person.name}</p>
                  {current.createdAtLabel && (
                    <p className="truncate text-[10px] text-white/70">{current.createdAtLabel}</p>
                  )}
                </div>
              </Link>

              <div className="ml-auto flex items-center gap-1">
                {current && canDeleteSlide?.(current.id) && (
                  <IconBtn
                    label="Delete"
                    onClick={() => {
                      if (!current) return;
                      onDeleteSlide?.(current.id);
                      // Close if this was the last slide of the last reel
                      if (slidesCount <= 1 && reels.length <= 1) onOpenChange(false);
                      else nextSlide();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                )}
                <IconBtn label={paused ? "Play" : "Pause"} onClick={() => setPaused((p) => !p)}>
                  {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </IconBtn>
                {current.kind === "video" && (
                  <IconBtn label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)}>
                    {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </IconBtn>
                )}
                <IconBtn label="Close" onClick={() => onOpenChange(false)}>
                  <X className="h-4 w-4" />
                </IconBtn>
              </div>
            </div>

            <button type="button" aria-label="Previous" onClick={prevSlide}
              className="absolute inset-y-0 left-0 z-10 w-1/3 focus:outline-none" />
            <button type="button" aria-label="Next" onClick={nextSlide}
              className="absolute inset-y-0 right-0 z-10 w-1/3 focus:outline-none" />

            {/* Like bar */}
            {onToggleLike && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-end bg-gradient-to-t from-black/70 to-transparent px-3 pb-4 pt-16">
                <button
                  type="button"
                  onClick={toggleLike}
                  aria-label={likedNow ? "Unlike story" : "Like story"}
                  aria-pressed={likedNow}
                  className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-white backdrop-blur-md transition hover:bg-black/60"
                >
                  <Heart
                    className={`h-5 w-5 transition ${
                      likedNow ? "fill-red-500 text-red-500" : "text-white"
                    }`}
                  />
                  <span className="min-w-[1ch] text-sm font-semibold tabular-nums">
                    {formatCount(likeCountNow)}
                  </span>
                </button>
              </div>
            )}

            <button type="button" aria-label="Previous story" onClick={prevSlide}
              className="absolute -left-12 top-1/2 z-30 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20 sm:block">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" aria-label="Next story" onClick={nextSlide}
              className="absolute -right-12 top-1/2 z-30 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20 sm:block">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-full text-white/90 transition hover:bg-white/15">
      {children}
    </button>
  );
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (n < 1_000_000) return `${Math.floor(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

export function buildStoryReels(
  creators: Array<{
    user_id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    cover_url: string | null;
    is_verified?: boolean;
  }>,
): StoryReel[] {
  return creators
    .map<StoryReel | null>((c) => {
      const url = c.cover_url || c.avatar_url;
      if (!url) return null;
      return {
        person: {
          user_id: c.user_id,
          name: c.display_name || c.username || "Creator",
          handle: c.username,
          avatar_url: c.avatar_url,
          cover_url: c.cover_url,
          is_verified: c.is_verified,
        },
        slides: [{ id: `${c.user_id}-1`, url, kind: "image", createdAtLabel: "Today" }],
      };
    })
    .filter((r): r is StoryReel => r !== null);
}
