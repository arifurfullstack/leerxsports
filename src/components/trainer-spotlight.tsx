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

  return (
    <div className="relative">
      {/* Prev / Next — hidden on touch by default via responsive breakpoints. */}
      <div className="pointer-events-none absolute -top-14 right-0 hidden gap-2 md:flex">
        <div
          role="radiogroup"
          aria-label="Autoplay interval"
          className="pointer-events-auto flex h-11 items-center gap-1 rounded-full border border-[#4a4a4a] bg-[#2d2d2d] p-1"
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
                className={`min-h-9 rounded-full px-3 text-[11px] font-sans uppercase tracking-[0.18em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e85d3a]/70 ${
                  selected
                    ? "bg-[#e85d3a] text-[#1a1a1a]"
                    : "text-neutral-300 hover:text-[#e85d3a]"
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
          className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-[#4a4a4a] bg-[#2d2d2d] text-white transition-colors hover:border-[#e85d3a]/60 hover:text-[#e85d3a]"
        >
          {userPaused ? <Play className="h-5 w-5" aria-hidden /> : <Pause className="h-5 w-5" aria-hidden />}
        </button>
        <button
          type="button"
          aria-label="Previous trainer"
          onClick={() => scrollTo(Math.max(active - 1, 0))}
          disabled={active === 0}
          className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-[#4a4a4a] bg-[#2d2d2d] text-white transition-colors hover:border-[#e85d3a]/60 hover:text-[#e85d3a] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Next trainer"
          onClick={() => scrollTo(Math.min(active + 1, TRAINERS.length - 1))}
          disabled={active === TRAINERS.length - 1}
          className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-[#4a4a4a] bg-[#2d2d2d] text-white transition-colors hover:border-[#e85d3a]/60 hover:text-[#e85d3a] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
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
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e85d3a]/60 sm:-mx-6 sm:gap-5 sm:px-6"
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
            className="tile-anim group relative flex w-[86%] shrink-0 snap-center flex-col overflow-hidden rounded-3xl border border-[#4a4a4a] bg-[#2d2d2d] transition-colors hover:border-[#e85d3a]/50 sm:w-[62%] md:w-[42%] lg:w-[32%]"
            style={{ ["--tile-delay" as string]: `${i * 80}ms` }}
          >
            <div className="relative aspect-[4/5] overflow-hidden bg-[#1a1a1a]">
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
                className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-[#1a1a1a]/40 to-transparent"
              />
              <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-[#e85d3a]/60 bg-[#1a1a1a]/85 px-3 py-1 text-[10px] font-sans uppercase tracking-[0.22em] text-[#e85d3a] backdrop-blur">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                Verified
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                <div className="text-[10px] font-sans uppercase tracking-[0.22em] text-neutral-400">
                  {t.sport} · {t.location}
                </div>
                <h3 className="mt-2 type-tile-lg font-display uppercase leading-[1.05] text-white">
                  {t.name}
                </h3>
                <div className="mt-3 flex items-center gap-4 text-xs font-sans uppercase tracking-[0.14em] text-neutral-300">
                  <span className="inline-flex items-center gap-1 text-white">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                    {t.rating.toFixed(1)}
                  </span>
                  <span>{t.programs} programs</span>
                  <span>{t.members} members</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 p-5 sm:p-6">
              <p className="type-small line-clamp-2 flex-1 font-sans text-neutral-400">
                {t.tag} — {t.specialties[0]}, {t.specialties[1] ?? "coaching"}.
              </p>
              <button
                type="button"
                onClick={(e) => openTrainer(t, i, e.currentTarget)}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[#4a4a4a] bg-[#1a1a1a] px-4 py-2 text-xs font-sans uppercase tracking-[0.18em] text-white transition-colors hover:border-[#e85d3a]/60 hover:text-[#e85d3a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e85d3a]/70"
                aria-label={`Open details for ${t.name}`}
              >
                View
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Live region + dots */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Slide {active + 1} of {TRAINERS.length}: {TRAINERS[active]?.name}
      </div>
      <div className="mt-4 flex items-center justify-center gap-2">
        {TRAINERS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => scrollTo(i)}
            aria-label={`Go to trainer ${i + 1}: ${t.name}`}
            aria-current={active === i}
            className={`h-2.5 min-h-[11px] rounded-full transition-all ${
              active === i
                ? "w-6 bg-[#e85d3a]"
                : "w-2.5 bg-[#4a4a4a] hover:bg-[#e85d3a]/50"
            }`}
          />
        ))}
      </div>

      <Drawer open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DrawerContent
          className="border-[#4a4a4a] bg-[#1a1a1a] text-white"
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
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-[#1a1a1a]/60 to-transparent" />
                <DrawerClose
                  aria-label="Close trainer details"
                  className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full border border-[#4a4a4a] bg-[#1a1a1a]/80 text-white backdrop-blur transition-colors hover:border-[#e85d3a]/60 hover:text-[#e85d3a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e85d3a]/70"
                >
                  <X className="h-5 w-5" aria-hidden />
                </DrawerClose>
              </div>
              <DrawerHeader className="max-w-2xl px-6 pt-6 text-left sm:mx-auto sm:px-8">
                <div className="inline-flex items-center gap-2 text-[10px] font-sans uppercase tracking-[0.22em] text-[#e85d3a]">
                  <ShieldCheck className="h-3 w-3" aria-hidden />
                  Verified pro · {open.location}
                </div>
                <DrawerTitle className="type-tile-lg font-display uppercase text-white">
                  {open.name}
                </DrawerTitle>
                <DrawerDescription className="type-small font-sans text-neutral-400">
                  {open.sport} · {open.tag}
                </DrawerDescription>
              </DrawerHeader>
              <div className="mx-auto max-h-[50vh] w-full max-w-2xl overflow-y-auto px-6 pb-8 sm:px-8">
                <p className="type-small font-sans text-neutral-200">{open.bio}</p>
                <dl className="mt-6 grid grid-cols-3 gap-3 border-y border-[#4a4a4a]/60 py-5">
                  <div>
                    <dt className="text-[10px] font-sans uppercase tracking-[0.2em] text-neutral-500">Rating</dt>
                    <dd className="mt-1 inline-flex items-center gap-1 font-display text-lg text-white">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
                      {open.rating.toFixed(1)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-sans uppercase tracking-[0.2em] text-neutral-500">Programs</dt>
                    <dd className="mt-1 font-display text-lg text-white">{open.programs}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-sans uppercase tracking-[0.2em] text-neutral-500">Members</dt>
                    <dd className="mt-1 font-display text-lg text-white">{open.members}</dd>
                  </div>
                </dl>
                <div className="mt-5">
                  <div className="text-[10px] font-sans uppercase tracking-[0.2em] text-neutral-500">Specialties</div>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {open.specialties.map((s) => (
                      <li key={s} className="rounded-full border border-[#4a4a4a] bg-[#2d2d2d] px-3 py-1 text-xs font-sans text-neutral-200">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-4">
                  <div className="text-[10px] font-sans uppercase tracking-[0.2em] text-neutral-500">Languages</div>
                  <div className="mt-2 text-sm font-sans text-neutral-300">{open.languages.join(" · ")}</div>
                </div>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  {open.username ? (
                    <Link
                      to="/trainers/$username"
                      params={{ username: open.username }}
                      onClick={() => track("trainer_drawer_cta", { trainer_id: open.id, target: "view_profile" })}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#e85d3a] px-6 py-3 text-sm font-sans uppercase tracking-[0.18em] text-[#1a1a1a] transition-colors hover:bg-[#f06d4a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e85d3a]/70"
                    >
                      View full profile
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  ) : (
                    <Link
                      to="/browse"
                      onClick={() => track("trainer_drawer_cta", { trainer_id: open.id, target: "view_profile" })}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#e85d3a] px-6 py-3 text-sm font-sans uppercase tracking-[0.18em] text-[#1a1a1a] transition-colors hover:bg-[#f06d4a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e85d3a]/70"
                    >
                    View full profile
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  )}
                  <DrawerClose className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#4a4a4a] px-6 py-3 text-sm font-sans uppercase tracking-[0.18em] text-white transition-colors hover:border-[#e85d3a]/60 hover:text-[#e85d3a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e85d3a]/70">
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