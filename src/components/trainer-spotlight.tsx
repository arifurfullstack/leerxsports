import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ResponsiveImage } from "@/components/responsive-image";
import { buildResponsive } from "@/lib/demo-media";
import { track } from "@/lib/analytics";
import { getSpotlightTrainers, type SpotlightTrainer } from "@/lib/trainer-functions";

const AUTOPLAY_INTERVALS = [3000, 5000, 8000] as const;
type AutoplayInterval = (typeof AUTOPLAY_INTERVALS)[number];
const AUTOPLAY_STORAGE_KEY = "leer_trainer_autoplay_ms";
const AUTOPLAY_PAUSED_STORAGE_KEY = "leer_trainer_autoplay_paused";
const DEFAULT_INTERVAL: AutoplayInterval = 5000;

function readStoredInterval(): AutoplayInterval {
  if (typeof window === "undefined") return DEFAULT_INTERVAL;
  try {
    const raw = window.localStorage.getItem(AUTOPLAY_STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    if ((AUTOPLAY_INTERVALS as readonly number[]).includes(n)) {
      return n as AutoplayInterval;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_INTERVAL;
}

function readStoredPaused(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AUTOPLAY_PAUSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

type Trainer = {
  id: string;
  name: string;
  sport: string;
  tag: string;
  location: string;
  rating: number;
  programs: number;
  members: string;
  bio: string;
  specialties: string[];
  languages: string[];
  username?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
};

const FALLBACK_TRAINERS: Trainer[] = [
  {
    id: "ana-vasquez",
    name: "Ana Vasquez",
    sport: "Strength",
    tag: "Ex-national team",
    location: "Madrid · ES",
    rating: 4.9,
    programs: 12,
    members: "2.4k",
    bio: "Powerlifting national medalist turned coach. Structured hypertrophy blocks with weekly video review.",
    specialties: ["Powerlifting", "Hypertrophy", "Meet prep"],
    languages: ["English", "Español"],
  },
  {
    id: "kenji-ito",
    name: "Kenji Ito",
    sport: "Conditioning",
    tag: "Olympic prep",
    location: "Tokyo · JP",
    rating: 4.8,
    programs: 9,
    members: "1.8k",
    bio: "Track & field S&C coach. Six-week conditioning arcs built for athletes who plateau on generic apps.",
    specialties: ["Sprint mechanics", "Plyo", "Return-to-play"],
    languages: ["日本語", "English"],
  },
  {
    id: "mara-okafor",
    name: "Mara Okafor",
    sport: "Combat",
    tag: "Pro boxer",
    location: "Lagos · NG",
    rating: 5.0,
    programs: 7,
    members: "3.1k",
    bio: "Undefeated regional welterweight. Fight-camp plans, footwork drills, and film breakdowns weekly.",
    specialties: ["Boxing", "Footwork", "Fight camp"],
    languages: ["English"],
  },
  {
    id: "leah-chen",
    name: "Leah Chen",
    sport: "Mobility",
    tag: "PT & movement",
    location: "Vancouver · CA",
    rating: 4.9,
    programs: 14,
    members: "4.2k",
    bio: "Physiotherapist and mobility specialist. Joint-by-joint programs that stack under any strength block.",
    specialties: ["Mobility", "Rehab", "Warm-ups"],
    languages: ["English", "中文"],
  },
  {
    id: "diego-santos",
    name: "Diego Santos",
    sport: "HIIT",
    tag: "Ironman finisher",
    location: "São Paulo · BR",
    rating: 4.7,
    programs: 11,
    members: "2.0k",
    bio: "Endurance athlete running high-intensity blocks with weekly HR-zone check-ins.",
    specialties: ["HIIT", "Endurance", "Fat loss"],
    languages: ["Português", "English"],
  },
  {
    id: "ines-laurent",
    name: "Inès Laurent",
    sport: "Cycling",
    tag: "Pro peloton coach",
    location: "Lyon · FR",
    rating: 4.9,
    programs: 8,
    members: "1.5k",
    bio: "Road cycling coach with wattage-based programs and monthly video-form reviews on the bike.",
    specialties: ["FTP builds", "Climbing", "Race prep"],
    languages: ["Français", "English"],
  },
];

function formatMembers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

function seededRating(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  // 4.6 – 5.0
  return 4.6 + ((h % 5) / 10);
}

function mapSpotlight(t: SpotlightTrainer): Trainer {
  const name = t.display_name || t.username || "Trainer";
  const specialties = t.specialties.length ? t.specialties : ["Coaching"];
  const sport = specialties[0];
  return {
    id: t.user_id,
    name,
    sport,
    tag: t.is_verified ? "Verified pro" : "Coach",
    location: t.country || "Global",
    rating: seededRating(t.user_id),
    programs: t.programs,
    members: formatMembers(t.followers),
    bio: t.bio || `${name} — ${specialties.slice(0, 3).join(", ")}.`,
    specialties: specialties.slice(0, 6),
    languages: ["English"],
    username: t.username,
    avatar_url: t.avatar_url,
    cover_url: t.cover_url,
  };
}

export function TrainerSpotlight() {
  const fetchSpotlight = useServerFn(getSpotlightTrainers);
  const q = useQuery({
    queryKey: ["spotlight-trainers"],
    queryFn: () => fetchSpotlight(),
    staleTime: 60_000,
  });
  const showSkeleton = q.isLoading && !q.data;
  const TRAINERS: Trainer[] =
    q.data && q.data.length > 0 ? q.data.map(mapSpotlight) : FALLBACK_TRAINERS;
  const railRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState<Trainer | null>(null);
  const [hovering, setHovering] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [intervalMs, setIntervalMs] = useState<AutoplayInterval>(DEFAULT_INTERVAL);
  const activeRef = useRef(0);
  const invokerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // Hydrate persisted autoplay interval after mount (SSR-safe).
  useEffect(() => {
    setIntervalMs(readStoredInterval());
    setUserPaused(readStoredPaused());
  }, []);

  const togglePaused = useCallback(() => {
    setUserPaused((v) => {
      const next = !v;
      try {
        if (next) window.localStorage.setItem(AUTOPLAY_PAUSED_STORAGE_KEY, "1");
        else window.localStorage.removeItem(AUTOPLAY_PAUSED_STORAGE_KEY);
      } catch {
        /* storage may be blocked; state still updates for the session */
      }
      track("trainer_carousel_autoplay_toggle", { paused: next });
      return next;
    });
  }, []);

  const changeInterval = useCallback((ms: AutoplayInterval) => {
    setIntervalMs(ms);
    try {
      window.localStorage.setItem(AUTOPLAY_STORAGE_KEY, String(ms));
    } catch {
      /* storage may be blocked; state still updates for the session */
    }
    track("trainer_carousel_interval_change", { interval_ms: ms });
  }, []);

  // Prefetch neighboring slide images so swipe/autoplay reveals them instantly.
  // Uses the same responsive srcset the visible <img> will use, so the browser
  // reuses the cached candidate on paint. Cleaned up when the slide changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const neighbors = [active + 1, active - 1]
      .map((i) => TRAINERS[i])
      .filter(Boolean) as Trainer[];
    const imgs: HTMLImageElement[] = [];
    for (const t of neighbors) {
      const media = buildResponsive(null, "cover", `trainer-${t.id}`);
      const img = new Image();
      // Set srcset+sizes first so `src` resolution uses them.
      if (media.srcSet) img.srcset = media.srcSet;
      if (media.sizes) img.sizes = media.sizes;
      img.decoding = "async";
      // `fetchPriority` is a low-key hint; supported in Chromium/Safari.
      (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = "low";
      img.src = media.src;
      imgs.push(img);
    }
    return () => {
      // Drop refs so the browser can evict if unused.
      for (const i of imgs) i.src = "";
    };
  }, [active]);

  // Track which slide is currently centered for a11y live-region + dots.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const slides = Array.from(rail.querySelectorAll<HTMLElement>("[data-slide]"));
    if (slides.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        // Pick the entry with highest visible ratio.
        const best = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!best) return;
        const idx = Number(best.target.getAttribute("data-index"));
        if (!Number.isNaN(idx)) setActive(idx);
      },
      { root: rail, threshold: [0.5, 0.75, 1] },
    );
    slides.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  const scrollTo = useCallback((idx: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const target = rail.querySelector<HTMLElement>(`[data-index="${idx}"]`);
    if (!target) return;
    rail.scrollTo({ left: target.offsetLeft - rail.offsetLeft, behavior: "smooth" });
  }, []);

  // Autoplay: advance every 5s. Pauses on hover, focus-within, drawer open,
  // tab hidden, user preference (Pause button), and reduced-motion.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    if (hovering || open || userPaused) return;

    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (document.hidden) return;
      const next = (activeRef.current + 1) % TRAINERS.length;
      scrollTo(next);
    };
    const id = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [hovering, open, userPaused, intervalMs, scrollTo]);

  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        scrollTo(Math.min(active + 1, TRAINERS.length - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        scrollTo(Math.max(active - 1, 0));
      }
    },
    [active, scrollTo],
  );

  const openTrainer = (t: Trainer, idx: number, invoker: HTMLElement | null) => {
    invokerRef.current = invoker;
    setOpen(t);
    track("trainer_drawer_open", { trainer_id: t.id, position: idx });
  };

  if (showSkeleton) {
    return <TrainerSpotlightSkeleton />;
  }

  return (
    <div className="relative">
      {/* Controls — inline, full-width row so they never overlap the section copy. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
        <div className="flex items-center gap-3 text-[10px] font-sans font-bold uppercase tracking-[0.28em] text-muted-foreground">
          <span className="tabular-nums text-foreground">
            {String(active + 1).padStart(2, "0")}
          </span>
          <span className="h-px w-8 bg-border" aria-hidden />
          <span className="tabular-nums">{String(TRAINERS.length).padStart(2, "0")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            role="radiogroup"
            aria-label="Autoplay interval"
            className="flex h-10 items-center gap-0 border border-border"
          >
            {AUTOPLAY_INTERVALS.map((ms) => {
              const selected = ms === intervalMs;
              return (
                <button
                  key={ms}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`Autoplay every ${ms / 1000} seconds`}
                  onClick={() => changeInterval(ms)}
                  className={`min-h-10 min-w-10 border-r border-border px-3 text-[10px] font-sans font-bold uppercase tracking-[0.24em] transition-colors last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-premium/70 ${
                    selected
                      ? "bg-premium text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {ms / 1000}s
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-label={userPaused ? "Play trainer carousel autoplay" : "Pause trainer carousel autoplay"}
            aria-pressed={userPaused}
            onClick={togglePaused}
            className="grid h-10 w-10 place-items-center border border-border text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-premium/70"
          >
            {userPaused ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
          </button>
          <button
            type="button"
            aria-label="Previous trainer"
            onClick={() => scrollTo(Math.max(active - 1, 0))}
            disabled={active === 0}
            className="grid h-10 w-10 place-items-center border border-border text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-premium/70"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next trainer"
            onClick={() => scrollTo(Math.min(active + 1, TRAINERS.length - 1))}
            disabled={active === TRAINERS.length - 1}
            className="grid h-10 w-10 place-items-center border border-border text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-premium/70"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div
        ref={railRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Featured trainers"
        tabIndex={0}
        onKeyDown={onKey}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onFocus={() => setHovering(true)}
        onBlur={() => setHovering(false)}
        onPointerDown={(e) => {
          if (e.pointerType === "touch") setHovering(true);
        }}
        onPointerUp={(e) => {
          if (e.pointerType === "touch") {
            // Resume shortly after touch interaction ends.
            window.setTimeout(() => setHovering(false), 4000);
          }
        }}
        onScroll={() => {
          // Emit a single swipe event per user interaction burst.
          if ((railRef.current as any)?._swiped) return;
          (railRef.current as any)._swiped = true;
          track("trainer_carousel_swipe", { position: active });
          setTimeout(() => {
            if (railRef.current) (railRef.current as any)._swiped = false;
          }, 500);
        }}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-premium/60 sm:-mx-6 sm:gap-5 sm:px-6"
        style={{ scrollbarWidth: "none" }}
      >
        {TRAINERS.map((t, i) => (
          <article
            key={t.id}
            data-slide
            data-index={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${TRAINERS.length}: ${t.name}, ${t.sport}`}
            className="tile-anim group relative flex w-[86%] shrink-0 snap-center flex-col overflow-hidden border border-border bg-card transition-colors hover:border-premium/60 sm:w-[62%] md:w-[42%] lg:w-[32%]"
            style={{ ["--tile-delay" as string]: `${i * 80}ms` }}
          >
            <div className="relative aspect-[4/5] overflow-hidden bg-background">
              <ResponsiveImage
                src={t.cover_url ?? null}
                seed={`trainer-${t.id}`}
                variant="cover"
                alt={`Portrait of ${t.name}`}
                loading="lazy"
                decoding="async"
                fetchPriority={i === 0 ? "high" : "low"}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent"
              />
              <div className="absolute left-4 top-4 inline-flex items-center gap-2 bg-premium px-2.5 py-1 text-[10px] font-sans font-bold uppercase tracking-[0.28em] text-background">
                <ShieldCheck className="h-3 w-3" aria-hidden strokeWidth={3} />
                Verified
              </div>
              <div className="absolute right-4 top-4 inline-flex items-center gap-1 border border-border/60 bg-background/60 px-2 py-1 text-[10px] font-sans font-bold uppercase tracking-[0.22em] text-foreground backdrop-blur">
                <Star className="h-3 w-3 fill-premium text-premium" aria-hidden />
                {t.rating.toFixed(1)}
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                <div className="text-[10px] font-sans font-bold uppercase tracking-[0.28em] text-premium">
                  {t.sport} · {t.location}
                </div>
                <h3 className="mt-2 font-display italic uppercase leading-[0.95] tracking-tighter text-foreground text-[clamp(1.75rem,3.2vw,2.75rem)]">
                  {t.name}
                </h3>
                <div className="mt-3 flex items-center gap-3 text-[10px] font-sans font-bold uppercase tracking-[0.24em] text-foreground/70">
                  <span className="tabular-nums text-foreground">{t.programs}</span>
                  <span>Programs</span>
                  {t.members && t.members !== "0" ? (
                    <>
                      <span className="h-3 w-px bg-border" aria-hidden />
                      <span className="tabular-nums text-foreground">{t.members}</span>
                      <span>Members</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border p-5 sm:p-6">
              <p className="line-clamp-2 flex-1 text-xs font-sans uppercase tracking-[0.18em] text-muted-foreground">
                {t.tag} — {t.specialties[0]}, {t.specialties[1] ?? "coaching"}.
              </p>
              <button
                type="button"
                onClick={(e) => openTrainer(t, i, e.currentTarget)}
                className="group/btn inline-flex min-h-11 shrink-0 items-center gap-2 border border-border bg-background px-4 py-2 text-[10px] font-sans font-bold uppercase tracking-[0.28em] text-foreground transition-all duration-300 hover:border-foreground hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-premium/70"
                aria-label={`Open details for ${t.name}`}
              >
                View
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Live region + dots */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Slide {active + 1} of {TRAINERS.length}: {TRAINERS[active]?.name}
      </div>
      <div className="mt-6 flex items-center justify-center gap-2">
        {TRAINERS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => scrollTo(i)}
            aria-label={`Go to trainer ${i + 1}: ${t.name}`}
            aria-current={active === i}
            className={`h-[3px] min-h-[11px] transition-all ${
              active === i ? "w-10 bg-premium" : "w-6 bg-border hover:bg-premium/50"
            }`}
          />
        ))}
      </div>

      <Drawer open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DrawerContent
          className="border-border bg-background text-foreground"
          onCloseAutoFocus={(event) => {
            const invoker = invokerRef.current;
            if (invoker && document.contains(invoker)) {
              event.preventDefault();
              // Preserve the visible focus ring rather than mouse-only focus.
              invoker.focus({ preventScroll: true });
              invokerRef.current = null;
            }
          }}
        >
          {open && (
            <>
              <div className="relative aspect-[16/9] overflow-hidden">
                <ResponsiveImage
                  src={open.cover_url ?? null}
                  seed={`trainer-${open.id}`}
                  variant="cover"
                  alt=""
                  aria-hidden
                  loading="eager"
                  className="h-full w-full object-cover"
                />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                <DrawerClose
                  aria-label="Close trainer details"
                  className="absolute right-4 top-4 grid h-11 w-11 place-items-center border border-border bg-background/80 text-foreground backdrop-blur transition-colors hover:border-foreground hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-premium/70"
                >
                  <X className="h-5 w-5" aria-hidden />
                </DrawerClose>
              </div>
              <DrawerHeader className="max-w-2xl px-6 pt-6 text-left sm:mx-auto sm:px-8">
                <div className="inline-flex items-center gap-2 text-[10px] font-sans font-bold uppercase tracking-[0.28em] text-premium">
                  <ShieldCheck className="h-3 w-3" aria-hidden />
                  Verified pro · {open.location}
                </div>
                <DrawerTitle className="font-display italic uppercase tracking-tighter text-foreground text-[clamp(2rem,5vw,3.25rem)]">
                  {open.name}
                </DrawerTitle>
                <DrawerDescription className="text-sm font-sans text-muted-foreground">
                  {open.sport} · {open.tag}
                </DrawerDescription>
              </DrawerHeader>
              <div className="mx-auto max-h-[50vh] w-full max-w-2xl overflow-y-auto px-6 pb-8 sm:px-8">
                <p className="text-sm font-sans leading-relaxed text-foreground/80">{open.bio}</p>
                <dl className="mt-6 grid grid-cols-3 gap-3 border-y border-border py-5">
                  <div>
                    <dt className="text-[10px] font-sans font-bold uppercase tracking-[0.24em] text-muted-foreground">Rating</dt>
                    <dd className="mt-1 inline-flex items-center gap-1 font-display text-xl text-foreground">
                      <Star className="h-4 w-4 fill-premium text-premium" aria-hidden />
                      {open.rating.toFixed(1)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-sans font-bold uppercase tracking-[0.24em] text-muted-foreground">Programs</dt>
                    <dd className="mt-1 font-display text-xl tabular-nums text-foreground">{open.programs}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-sans font-bold uppercase tracking-[0.24em] text-muted-foreground">Members</dt>
                    <dd className="mt-1 font-display text-xl tabular-nums text-foreground">{open.members || "0"}</dd>
                  </div>
                </dl>
                <div className="mt-5">
                  <div className="text-[10px] font-sans font-bold uppercase tracking-[0.24em] text-muted-foreground">Specialties</div>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {open.specialties.map((s) => (
                      <li key={s} className="border border-border bg-card px-3 py-1 text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-foreground/80">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-4">
                  <div className="text-[10px] font-sans font-bold uppercase tracking-[0.24em] text-muted-foreground">Languages</div>
                  <div className="mt-2 text-sm font-sans text-foreground/80">{open.languages.join(" · ")}</div>
                </div>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  {open.username ? (
                    <Link
                      to="/trainers/$username"
                      params={{ username: open.username }}
                      onClick={() => track("trainer_drawer_cta", { trainer_id: open.id, target: "view_profile" })}
                      className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 bg-premium px-6 py-3 text-xs font-sans font-bold uppercase tracking-[0.28em] text-background transition-all hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-premium/70"
                    >
                      View full profile
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  ) : (
                    <Link
                      to="/feed"
                      onClick={() => track("trainer_drawer_cta", { trainer_id: open.id, target: "view_profile" })}
                      className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 bg-premium px-6 py-3 text-xs font-sans font-bold uppercase tracking-[0.28em] text-background transition-all hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-premium/70"
                    >
                    View full profile
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  )}
                  <DrawerClose className="inline-flex min-h-12 items-center justify-center border border-border px-6 py-3 text-xs font-sans font-bold uppercase tracking-[0.28em] text-foreground transition-all hover:border-foreground hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-premium/70">
                    Close
                  </DrawerClose>
                </div>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function TrainerSpotlightSkeleton() {
  const tiles = Array.from({ length: 6 });
  return (
    <div className="relative" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading featured trainers…</span>
      {/* Controls skeleton */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
        <div className="flex items-center gap-3">
          <div className="h-3 w-6 skeleton-tile bg-muted/40" />
          <span className="h-px w-8 bg-border" aria-hidden />
          <div className="h-3 w-6 skeleton-tile bg-muted/40" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-10 items-center border border-border">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 w-12 border-r border-border last:border-r-0 skeleton-tile bg-muted/30" />
            ))}
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 w-10 border border-border skeleton-tile bg-muted/30" />
          ))}
        </div>
      </div>
      {/* Tiles skeleton */}
      <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-hidden px-4 pb-4 sm:-mx-6 sm:gap-5 sm:px-6">
        {tiles.map((_, i) => (
          <div
            key={i}
            className="relative flex w-[86%] shrink-0 snap-center flex-col overflow-hidden border border-border bg-card sm:w-[62%] md:w-[42%] lg:w-[32%]"
          >
            <div className="relative aspect-[4/5] skeleton-tile bg-muted/30">
              <div className="absolute left-4 top-4 h-5 w-20 skeleton-tile bg-muted/50" />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent"
              />
              <div className="absolute inset-x-4 bottom-4 space-y-2">
                <div className="h-3 w-16 skeleton-tile bg-muted/50" />
                <div className="h-6 w-3/4 skeleton-tile bg-muted/60" />
                <div className="h-3 w-1/2 skeleton-tile bg-muted/40" />
              </div>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-12 skeleton-tile bg-muted/40" />
                <div className="h-3 w-16 skeleton-tile bg-muted/40" />
              </div>
              <div className="h-3 w-full skeleton-tile bg-muted/30" />
              <div className="h-3 w-5/6 skeleton-tile bg-muted/30" />
              <div className="mt-2 flex gap-2">
                <div className="h-6 w-16 skeleton-tile bg-muted/40" />
                <div className="h-6 w-20 skeleton-tile bg-muted/40" />
                <div className="h-6 w-14 skeleton-tile bg-muted/40" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}