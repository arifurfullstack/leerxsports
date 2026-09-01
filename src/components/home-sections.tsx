import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Compass,
  UserCheck,
  Dumbbell,
  Trophy,
  Check,
  Activity,
  Crown,
  Flame,
  Waves,
  Bike,
  Mountain,
  HeartPulse,
  Video,
  Pause,
  Play,
  Plus,
  X,
  ShieldCheck,
  BadgeCheck,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHasBeenInView } from "@/hooks/use-hero-perf";
import { track, useImpression } from "@/lib/analytics";
import { TrainerSpotlight } from "@/components/trainer-spotlight";
import { useQuery } from "@tanstack/react-query";
import {
  listTestimonials,
  STATIC_TESTIMONIALS,
} from "@/lib/testimonials-functions";

/**
 * Homepage — supplemental sections rendered under the Kinetic Bento.
 * Direction: "Editorial high-impact" — oversized display numerals, ruled
 * dividers, full-bleed coral testimonial flood, split-rule pricing.
 * Palette locked: Charcoal & Ember (#1a1a1a / #2d2d2d / #4a4a4a / var(--premium)).
 * Every block lazy-mounts once in view so below-fold work stays cheap.
 */
export function HomeSections() {
  return (
    <>
      <HowItWorksSection />
      <DisciplinesSection />
      <TrainerSpotlightSection />
      <TestimonialsSection />
      <PricingSection />
      <FinalCtaSection />
    </>
  );
}

/* ─────────────────────────  How it works  ───────────────────────── */

function HowItWorksSection() {
  const [ref, seen] = useHasBeenInView<HTMLElement>("300px");
  useImpression(ref, "how_it_works");
  const steps = [
    {
      icon: Compass,
      kicker: "01",
      title: "Discover",
      body: "Browse verified pros by sport, language, and level. Every profile is ID-checked and rated by real members.",
    },
    {
      icon: UserCheck,
      kicker: "02",
      title: "Subscribe",
      body: "Unlock a creator's full library including programs, live sessions, and their private community feed.",
    },
    {
      icon: Video,
      kicker: "03",
      title: "Train 1:1",
      body: "Send form videos every month and get personalized feedback from your pro. No group chats, no noise.",
    },
  ];
  return (
    <section
      ref={ref}
      aria-label="How LEER works"
      data-inview={seen ? "true" : "false"}
      className="relative mx-auto max-w-6xl px-4 pb-16 sm:pb-24 pt-8 sm:px-6"
    >
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-baseline md:justify-between">
        <h2 className="reveal font-display uppercase leading-[0.9] tracking-tighter text-premium text-[clamp(2.5rem,8vw,6.5rem)]">
          Process
        </h2>
        <p className="reveal max-w-xs text-xs font-sans font-bold uppercase tracking-[0.28em] text-muted-foreground" style={{ ["--reveal-delay" as string]: "120ms" }}>
          A tight loop between you and a real coach with nothing in between.
        </p>
      </div>
      <ol
        className={`mt-14 grid grid-cols-1 gap-10 md:mt-16 md:grid-cols-3 md:gap-12 ${
          seen ? "opacity-100" : "opacity-0"
        } transition-opacity duration-500`}
      >
        {steps.map((s, i) => (
          <li
            key={s.kicker}
            className={`tile-anim group relative border-t border-border pt-14 ${
              i === 1 ? "md:mt-24" : ""
            }`}
            style={{ ["--tile-delay" as string]: `${i * 80}ms` }}
          >
            <span className="absolute left-0 top-4 font-display text-4xl leading-none tracking-tight text-premium md:text-5xl">
              {s.kicker}
            </span>
            <s.icon
              aria-hidden
              className="absolute right-0 top-5 h-6 w-6 text-muted-foreground/60 transition-colors group-hover:text-premium"
            />
            <h3 className="font-display uppercase text-foreground text-3xl leading-[0.95] md:text-4xl">
              {s.title}
            </h3>
            <p className="mt-5 max-w-sm text-base font-sans leading-relaxed text-muted-foreground">
              {s.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ─────────────────────────  Disciplines  ───────────────────────── */

function DisciplinesSection() {
  const [ref, seen] = useHasBeenInView<HTMLElement>("300px");
  useImpression(ref, "disciplines");
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const cats = [
    {
      icon: Dumbbell,
      label: "Strength",
      count: "142 pros",
      blurb:
        "Powerlifting, olympic lifting, and hypertrophy programming built around your equipment and schedule.",
      focus: ["Squat / Bench / Deadlift", "Olympic lifts", "Hypertrophy blocks"],
    },
    {
      icon: HeartPulse,
      label: "Conditioning",
      count: "98 pros",
      blurb:
        "Zone 2, threshold, and VO2 work programmed to move your engine efficiently.",
      focus: ["Zone 2 base", "Threshold intervals", "VO2 max"],
    },
    {
      icon: Flame,
      label: "HIIT",
      count: "76 pros",
      blurb:
        "Short, intense, structured sessions with recovery built-in so you can actually repeat them.",
      focus: ["EMOM / AMRAP", "Sprint intervals", "Metcon design"],
    },
    {
      icon: Waves,
      label: "Swim",
      count: "34 pros",
      blurb:
        "Freestyle technique, open-water pacing, and race-week tapers with video-based form review.",
      focus: ["Stroke mechanics", "Open water", "Race pacing"],
    },
    {
      icon: Bike,
      label: "Cycling",
      count: "51 pros",
      blurb:
        "Road, gravel, and indoor structured training with power-based zones and event peaking.",
      focus: ["FTP builds", "Climbing", "Race prep"],
    },
    {
      icon: Mountain,
      label: "Outdoor",
      count: "44 pros",
      blurb:
        "Trail running, hiking, and expedition prep with strength and conditioning that transfers to the terrain.",
      focus: ["Trail running", "Alpine prep", "Load carry"],
    },
    {
      icon: Trophy,
      label: "Combat",
      count: "62 pros",
      blurb:
        "Boxing, MMA, BJJ, and Muay Thai with technical drills, sparring prep, and fight-camp cycles.",
      focus: ["Striking", "Grappling", "Fight camp"],
    },
    {
      icon: Activity,
      label: "Mobility",
      count: "29 pros",
      blurb:
        "End-range strength, joint control, and daily flows to keep training pain-free long term.",
      focus: ["Joint CARs", "End-range strength", "Recovery flows"],
    },
  ];
  return (
    <section
      ref={ref}
      aria-label="Disciplines"
      data-inview={seen ? "true" : "false"}
      className="relative border-y border-border bg-white/[0.04]"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24 sm:px-6">
        <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-end md:justify-between">
          <h2 className="reveal font-display uppercase leading-[0.9] tracking-tighter text-foreground text-[clamp(2.5rem,8vw,6.5rem)]">
            Disciplines
          </h2>
          <Link
            to="/feed"
            onClick={() => track("home_cta_click", { section: "disciplines", target: "browse_all" })}
            className="reveal group inline-flex items-center gap-2 text-sm font-sans uppercase tracking-[0.2em] text-foreground hover:text-premium"
            style={{ ["--reveal-delay" as string]: "120ms" }}
          >
            Browse all
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        <div
          className={`mt-14 -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-3 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 md:gap-4 lg:grid-cols-4 ${
            seen ? "opacity-100" : "opacity-0"
          } transition-opacity duration-500`}
        >
          {cats.map((c, i) => {
            const isOpen = openIdx === i;
            const panelId = `discipline-panel-${i}`;
            return (
            <button
              key={c.label}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => {
                const next = isOpen ? null : i;
                setOpenIdx(next);
                if (!isOpen) {
                  track("home_tile_click", { section: "disciplines", label: c.label });
                }
              }}
              className={`tile-anim group relative aspect-square w-[46vw] max-w-[240px] shrink-0 snap-start overflow-hidden border bg-card text-left transition-[transform,border-color,background-color] duration-300 [-webkit-tap-highlight-color:transparent] touch-manipulation select-none hover:border-premium/60 hover:bg-card active:border-premium active:bg-card motion-safe:hover:-translate-y-1 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-premium/70 sm:w-auto sm:max-w-none sm:shrink sm:snap-none ${
                isOpen ? "border-premium bg-card" : "border-border"
              }`}
              style={{ ["--tile-delay" as string]: `${i * 45}ms` }}
            >
              {/* Ember wash */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-premium/25 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-active:opacity-100"
              />


              {/* Content */}
              <div className="relative z-10 flex h-full flex-col justify-between p-5 sm:p-6">
                <div className="flex items-start justify-between">
                  <span className="font-display text-xs leading-none text-muted-foreground/60 transition-colors duration-300 group-hover:text-premium group-active:text-premium">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    aria-hidden
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-premium/10 text-premium ring-1 ring-inset ring-premium/30 transition-transform duration-500 motion-safe:group-hover:scale-110 motion-safe:group-hover:-rotate-6 motion-safe:group-active:scale-110 sm:h-12 sm:w-12"
                  >
                    <c.icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
                  </span>
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-sans font-semibold uppercase tracking-[0.24em] text-premium opacity-80 md:text-[11px]">
                    {c.count}
                  </div>
                  <div className="font-display uppercase leading-[0.9] tracking-tight text-foreground text-2xl sm:text-3xl transition-transform duration-300 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-active:-translate-y-0.5">
                    {c.label}
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-sans font-semibold uppercase tracking-[0.24em] text-muted-foreground group-hover:text-foreground group-active:text-foreground">
                    <Plus
                      className={`h-3 w-3 transition-transform duration-300 ${
                        isOpen ? "rotate-45" : "rotate-0"
                      }`}
                    />
                    {isOpen ? "Close" : "Read more"}
                  </div>
                </div>
              </div>

              {/* Decorative corner accent — snaps in on hover */}
              <div
                aria-hidden
                className={`pointer-events-none absolute bottom-0 right-0 h-8 w-8 border-b-2 border-r-2 border-premium transition-transform duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-active:translate-x-0 group-active:translate-y-0 ${
                  isOpen ? "translate-x-0 translate-y-0" : "translate-x-4 translate-y-4"
                }`}
              />
            </button>
          );
          })}
        </div>
        {/* Mobile swipe hint */}
        <div
          aria-hidden
          className="mt-2 flex items-center gap-1.5 text-[10px] font-sans font-semibold uppercase tracking-[0.24em] text-muted-foreground/70 sm:hidden"
        >
          <span>Swipe</span>
          <ArrowRight className="h-3 w-3" />
        </div>
        {/* Expanded panel — renders below the grid and reflects the selected tile */}
        <div
          aria-live="polite"
          className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
            openIdx !== null ? "mt-4 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            {openIdx !== null && (() => {
              const c = cats[openIdx];
              const panelId = `discipline-panel-${openIdx}`;
              const Icon = c.icon;
              return (
                <div
                  id={panelId}
                  role="region"
                  aria-label={`${c.label} details`}
                  className="relative border border-premium/40 bg-card p-6 sm:p-8"
                >
                  <button
                    type="button"
                    onClick={() => setOpenIdx(null)}
                    aria-label="Close details"
                    className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground/80 transition hover:border-premium hover:text-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-premium/70"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
                    <div className="flex items-center gap-4">
                      <span
                        aria-hidden
                        className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-premium/10 text-premium ring-1 ring-inset ring-premium/40"
                      >
                        <Icon className="h-7 w-7" strokeWidth={1.75} />
                      </span>
                      <div>
                        <div className="text-[10px] font-sans font-semibold uppercase tracking-[0.24em] text-premium">
                          {c.count}
                        </div>
                        <h3 className="mt-1 font-display uppercase leading-[0.9] tracking-tight text-foreground text-3xl sm:text-4xl">
                          {c.label}
                        </h3>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="max-w-2xl text-base font-sans leading-relaxed text-foreground/80">
                        {c.blurb}
                      </p>
                      <ul className="mt-5 flex flex-wrap gap-2">
                        {c.focus.map((f) => (
                          <li
                            key={f}
                            className="border border-border bg-white/[0.03] px-3 py-1.5 text-[11px] font-sans font-semibold uppercase tracking-[0.18em] text-foreground/75"
                          >
                            {f}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-6">
                        <Link
                          to="/feed"
                          onClick={() =>
                            track("home_cta_click", {
                              section: "disciplines",
                              target: "browse_discipline",
                              label: c.label,
                            })
                          }
                          className="group inline-flex items-center gap-2 border border-premium bg-[var(--premium)] px-5 py-2.5 text-xs font-sans font-bold uppercase tracking-[0.24em] text-background transition hover:bg-premium/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-premium/70"
                        >
                          Browse {c.label} pros
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────  Trainer spotlight  ───────────────────────── */

function TrainerSpotlightSection() {
  const [ref, seen] = useHasBeenInView<HTMLElement>("300px");
  useImpression(ref, "trainer_spotlight");
  return (
    <section
      ref={ref}
      aria-label="Trainer spotlight"
      data-inview={seen ? "true" : "false"}
      className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28"
    >
      <div className="grid gap-6 md:grid-cols-[1.6fr_1fr] md:items-end md:gap-10">
        <div className="reveal">
          <div className="inline-flex items-center gap-3 text-[10px] font-sans font-bold uppercase tracking-[0.32em] text-premium">
            <span className="h-px w-8 bg-premium" aria-hidden />
            Meet the pros
          </div>
          <h2 className="mt-4 font-display italic uppercase leading-[0.85] tracking-tighter text-foreground text-[clamp(3rem,10vw,7.5rem)]">
            Verified <span className="text-premium">Pros.</span>
          </h2>
        </div>
        <p
          className="reveal max-w-sm text-sm font-sans leading-relaxed text-foreground/55 md:text-right"
          style={{ ["--reveal-delay" as string]: "120ms" }}
        >
          Olympians, national champions, and certified pros, verified before they publish.
        </p>
      </div>
      <div className={`mt-12 ${seen ? "opacity-100" : "opacity-0"} transition-opacity duration-500`}>
        <TrainerSpotlight />
      </div>
      <div className="mt-10 flex justify-center">
        <Link
          to="/feed"
          onClick={() => track("home_cta_click", { section: "trainer_spotlight", target: "see_all_pros" })}
          className="group inline-flex items-center gap-3 border border-border px-8 py-4 text-xs font-sans font-bold uppercase tracking-[0.28em] text-foreground transition-all duration-300 hover:border-foreground hover:bg-foreground hover:text-background"
        >
          See every pro
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  );
}

/* ─────────────────────────  Testimonials  ───────────────────────── */

function TestimonialsSection() {
  const [ref, seen] = useHasBeenInView<HTMLElement>("300px");
  useImpression(ref, "testimonials");
  return (
    <section
      ref={ref}
      aria-label="Testimonials"
      data-inview={seen ? "true" : "false"}
      className="relative overflow-hidden bg-background text-foreground"
    >
      {/* Hairline top divider — the only chrome */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-foreground/10" />

      <div className="relative mx-auto max-w-5xl px-6 py-24 md:py-32">
        <div className="mb-14 flex items-end justify-between gap-6">
          <div>
            <div
              className="reveal type-eyebrow font-sans font-medium text-muted-foreground"
            >
              Testimonials
            </div>
            <h2
              className="reveal mt-3 font-display text-foreground text-[clamp(1.75rem,3.4vw,2.75rem)] leading-[1.05] tracking-tight"
              style={{ ["--reveal-delay" as string]: "80ms" }}
            >
              What members say.
            </h2>
          </div>
          <div
            className="reveal hidden shrink-0 items-baseline gap-2 text-muted-foreground sm:flex"
            style={{ ["--reveal-delay" as string]: "160ms" }}
          >
            <span className="font-display text-3xl leading-none text-foreground">4.9</span>
            <span className="text-xs uppercase tracking-[0.22em]">avg · 1.2k athletes</span>
          </div>
        </div>

        <div
          className={`transition-opacity duration-500 ${seen ? "opacity-100" : "opacity-0"}`}
        >
          <TestimonialsCarousel />
        </div>
      </div>
    </section>
  );
}

/* ────────────────────  Testimonials — carousel  ──────────────────── */
// Data is loaded from `listTestimonials` (server fn backed by the
// `public.testimonials` table). `STATIC_TESTIMONIALS` seeds the query so
// SSR + first paint always have content, and any API failure falls back
// to the same list.

const TESTIMONIAL_INTERVAL_KEY = "leer_testimonials_autoplay_ms";
const TESTIMONIAL_INTERVAL_OPTIONS = [
  { ms: 4000, label: "4s" },
  { ms: 6000, label: "6s" },
  { ms: 10000, label: "10s" },
] as const;
const DEFAULT_TESTIMONIAL_INTERVAL = 6000;

/**
 * Testimonial avatar. Renders an optimized image when a URL is provided and
 * falls back to initials on network / decode failure. The wrapper size is
 * fixed via responsive Tailwind classes so cards align across breakpoints
 * whether or not the image ever loads.
 */
function TestimonialAvatar({
  src,
  name,
  initials,
  eager,
}: {
  src: string | null;
  name: string;
  initials: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  // Serve a 2x variant to devicePixelRatio-2 screens when the source is an
  // Unsplash URL (already accepts width params). Keeps rendered size fixed.
  const src2x =
    src && /[?&]w=\d+/.test(src) ? src.replace(/([?&]w=)\d+/, "$1128") : src;
  return (
    <div
      className="relative aspect-square h-10 w-10 shrink-0 overflow-hidden rounded-full border border-foreground/15 bg-muted sm:h-11 sm:w-11"
      aria-hidden
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          srcSet={src && src2x ? `${src} 1x, ${src2x} 2x` : undefined}
          alt=""
          width={44}
          height={44}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span
          role="img"
          aria-label={name}
          className="absolute inset-0 grid place-items-center font-sans text-xs font-medium text-foreground/80"
        >
          {initials}
        </span>
      )}
    </div>
  );
}

function TestimonialsCarousel() {
  const { data: quotes = STATIC_TESTIMONIALS } = useQuery({
    queryKey: ["home", "testimonials"],
    queryFn: () => listTestimonials(),
    initialData: STATIC_TESTIMONIALS,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
  const railRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const [hovering, setHovering] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [intervalMs, setIntervalMs] = useState<number>(DEFAULT_TESTIMONIAL_INTERVAL);
  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startScroll: number;
    moved: boolean;
    isTouch: boolean;
  } | null>(null);

  // Hydrate persisted interval + pause state from localStorage on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(TESTIMONIAL_INTERVAL_KEY);
      const parsed = raw ? Number(raw) : NaN;
      if (
        Number.isFinite(parsed) &&
        TESTIMONIAL_INTERVAL_OPTIONS.some((o) => o.ms === parsed)
      ) {
        setIntervalMs(parsed);
      }
    } catch {
      // ignore quota / access errors
    }
  }, []);

  const changeInterval = (ms: number) => {
    setIntervalMs(ms);
    try {
      window.localStorage.setItem(TESTIMONIAL_INTERVAL_KEY, String(ms));
    } catch {
      // ignore
    }
    track("testimonials_autoplay_interval", { ms });
  };

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // Track the centered slide via IntersectionObserver so dots + live region
  // stay in sync whether the user swipes, autoplays, or uses arrow keys.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const slides = Array.from(rail.querySelectorAll<HTMLElement>("[data-slide]"));
    if (slides.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
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

  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        scrollTo(Math.min(active + 1, quotes.length - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        scrollTo(Math.max(active - 1, 0));
      } else if (e.key === "Home") {
        e.preventDefault();
        scrollTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        scrollTo(quotes.length - 1);
      }
    },
    [active, scrollTo],
  );

  // Auto-rotate every 6s. Pauses on hover, focus-within, tab hidden,
  // reduced-motion, or explicit user pause.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || hovering || paused || dragging) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      const next = (activeRef.current + 1) % quotes.length;
      scrollTo(next);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [dragging, hovering, intervalMs, paused, scrollTo]);

  const togglePaused = () => {
    setPaused((v) => {
      const next = !v;
      track("testimonials_autoplay_toggle", { paused: next });
      return next;
    });
  };

  // Snap to whichever slide is nearest the rail's left edge after a drag.
  const snapToNearest = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const slides = Array.from(rail.querySelectorAll<HTMLElement>("[data-slide]"));
    if (slides.length === 0) return;
    const railLeft = rail.getBoundingClientRect().left;
    let bestIdx = 0;
    let bestDist = Infinity;
    slides.forEach((s, i) => {
      const d = Math.abs(s.getBoundingClientRect().left - railLeft);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    scrollTo(bestIdx);
  }, [scrollTo]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rail = railRef.current;
    if (!rail) return;
    // Let native touch scrolling handle finger drags — pointer capture would
    // hijack the browser's momentum + snap. Only intercept mouse/pen.
    if (e.pointerType === "touch") {
      dragState.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startScroll: rail.scrollLeft,
        moved: false,
        isTouch: true,
      };
      setDragging(true);
      return;
    }
    dragState.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startScroll: rail.scrollLeft,
      moved: false,
      isTouch: false,
    };
    rail.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragState.current;
    const rail = railRef.current;
    if (!state || !rail || state.pointerId !== e.pointerId) return;
    if (state.isTouch) return; // native scroll drives the rail
    const dx = e.clientX - state.startX;
    if (Math.abs(dx) > 3) state.moved = true;
    rail.scrollLeft = state.startScroll - dx;
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragState.current;
    if (!state || state.pointerId !== e.pointerId) return;
    const rail = railRef.current;
    if (rail && !state.isTouch && rail.hasPointerCapture(e.pointerId)) {
      rail.releasePointerCapture(e.pointerId);
    }
    const wasMouseDrag = !state.isTouch && state.moved;
    dragState.current = null;
    setDragging(false);
    if (wasMouseDrag) snapToNearest();
  };

  // Minimal controls: hairline circular buttons against the site background.
  const ctrl =
    "pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-foreground/15 bg-transparent text-foreground/80 transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-30";
  return (
    <div className="relative">
      {/* Toolbar — visible on all breakpoints, responsive layout */}
      <div className="mb-8 flex items-center justify-between gap-3">
        <div
          aria-hidden="true"
          className="flex items-baseline gap-2 font-sans text-xs uppercase tracking-[0.22em] text-muted-foreground"
        >
          <span className="tabular-nums text-foreground">{String(active + 1).padStart(2, "0")}</span>
          <span aria-hidden className="opacity-40">/</span>
          <span className="tabular-nums">{String(quotes.length).padStart(2, "0")}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={paused ? "Play testimonials autoplay" : "Pause testimonials autoplay"}
            aria-pressed={paused}
            aria-controls="testimonials-rail"
            onClick={togglePaused}
            className={ctrl}
          >
            {paused ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
          </button>
          <button
            type="button"
            aria-label="Previous testimonial"
            aria-controls="testimonials-rail"
            onClick={() => scrollTo(Math.max(active - 1, 0))}
            disabled={active === 0}
            className={ctrl}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next testimonial"
            aria-controls="testimonials-rail"
            onClick={() => scrollTo(Math.min(active + 1, quotes.length - 1))}
            disabled={active === quotes.length - 1}
            className={ctrl}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <p id="testimonials-instructions" className="sr-only">
        Use the left and right arrow keys to move between testimonials. Press Home for the first and End for the last. Autoplay pauses on hover, focus, or when you tap pause.
      </p>

      <div
        ref={railRef}
        id="testimonials-rail"
        role="region"
        aria-roledescription="carousel"
        aria-label="Member testimonials"
        aria-describedby="testimonials-instructions"
        tabIndex={0}
        onKeyDown={onKey}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onFocus={() => setHovering(true)}
        onBlur={() => setHovering(false)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`scrollbar-none -mx-6 flex snap-x snap-mandatory overflow-x-auto scroll-smooth px-6 pb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md ${
          dragging ? "cursor-grabbing select-none [scroll-behavior:auto]" : "cursor-grab"
        }`}
        style={{ scrollbarWidth: "none" }}
      >
        {quotes.map((q, i) => {
          const initials = q.name
            .split(/\s+/)
            .map((p) => p[0])
            .filter(Boolean)
            .slice(0, 2)
            .join("")
            .toUpperCase();
          const isActive = active === i;
          return (
            <figure
              key={q.name}
              data-slide
              data-index={i}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${quotes.length}: ${q.name}`}
              aria-hidden={isActive ? undefined : "true"}
              inert={!isActive}
              className="relative flex w-full shrink-0 snap-center flex-col justify-between gap-10 py-2 pr-6"
            >
              <blockquote className="font-sans text-foreground text-[clamp(1.375rem,2.6vw,2rem)] leading-[1.25] tracking-[-0.01em]">
                <span aria-hidden className="mr-1 text-primary">“</span>
                {q.body}
                <span aria-hidden className="ml-0.5 text-primary">”</span>
              </blockquote>

              <figcaption className="flex items-center gap-3">
                <TestimonialAvatar
                  src={q.avatar_url}
                  name={q.name}
                  initials={initials}
                  eager={i === 0}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-sans text-sm font-medium text-foreground">
                    {q.name}
                  </div>
                  <div className="truncate font-sans text-xs text-muted-foreground">
                    {q.role}
                  </div>
                </div>
              </figcaption>
            </figure>
          );
        })}
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Testimonial {active + 1} of {quotes.length}:{" "}
        {quotes[active]?.name}
      </div>

      <div
        className="mt-10 flex items-center justify-start gap-1.5"
        role="tablist"
        aria-label="Testimonial pagination"
      >
        {quotes.map((q, i) => (
          <button
            key={q.name}
            type="button"
            role="tab"
            aria-selected={active === i}
            aria-controls="testimonials-rail"
            tabIndex={active === i ? 0 : -1}
            onClick={() => scrollTo(i)}
            aria-label={`Show testimonial ${i + 1} of ${quotes.length}: ${q.name}`}
            aria-current={active === i}
            className="group relative flex h-11 items-center px-1 focus-visible:outline-none"
          >
            <span
              aria-hidden
              className={`block h-[2px] rounded-full transition-all group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background ${
                active === i
                  ? "w-8 bg-foreground"
                  : "w-4 bg-foreground/20 group-hover:bg-foreground/40"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────  Pricing  ───────────────────────── */

function PricingSection() {
  const [ref, seen] = useHasBeenInView<HTMLElement>("300px");
  useImpression(ref, "pricing");
  const tiers = [
    {
      name: "Explorer",
      price: "0",
      unit: "forever",
      tag: "Entry-level access",
      body: "Browse verified pros, preview programs, follow public feeds.",
      features: ["Public feed", "Creator previews", "Community read access"],
      cta: "Start free",
      to: "/auth" as const,
      accent: false,
    },
    {
      name: "Member",
      price: "19",
      unit: "/mo · per pro",
      tag: "Professional oversight",
      body: "Full access to one creator's library plus one private video review per month.",
      features: [
        "All programs from your pro",
        "1 private video coaching / mo",
        "Members-only community",
        "Multilingual captions",
      ],
      cta: "See creators",
      to: "/explore" as const,
      accent: true,
    },
  ];
  return (
    <section
      ref={ref}
      aria-label="Membership"
      data-inview={seen ? "true" : "false"}
      className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6"
    >
      {/* Ambient background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/3 -z-10 mx-auto h-[520px] max-w-4xl opacity-60"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, color-mix(in oklch, var(--premium) 22%, transparent) 0%, transparent 70%)",
        }}
      />
      <div className="text-center reveal">
        <div className="text-xs font-sans font-bold uppercase tracking-[0.28em] text-premium">
          Membership
        </div>
        <h2 className="mt-4 font-display uppercase leading-[0.9] tracking-tighter text-foreground text-[clamp(2.5rem,8vw,6.5rem)]">
          Investment
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-sm font-sans text-muted-foreground">
          Every subscription pays the pro directly. No hidden fees on the member side.
        </p>
      </div>
      <div
        className={`mt-14 grid grid-cols-1 gap-5 md:mt-16 md:grid-cols-2 md:gap-6 ${
          seen ? "opacity-100" : "opacity-0"
        } transition-opacity duration-500`}
      >
        {tiers.map((t, i) => (
          <article
            key={t.name}
            className={`tile-anim group relative flex flex-col overflow-hidden rounded-3xl p-7 transition-all duration-500 sm:p-9 md:p-10 ${
              t.accent
                ? "border border-premium/60 bg-gradient-to-b from-premium/15 via-card to-card shadow-[0_30px_80px_-30px_color-mix(in oklch, var(--premium) 55%, transparent)] motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[0_40px_100px_-30px_color-mix(in oklch, var(--premium) 70%, transparent)]"
                : "border border-border bg-card/80 backdrop-blur motion-safe:hover:-translate-y-1 motion-safe:hover:border-hairline-strong"
            }`}
            style={{ ["--tile-delay" as string]: `${i * 100}ms` }}
          >
            {/* Accent glow behind recommended card */}
            {t.accent && (
              <div
                aria-hidden
                className="pointer-events-none absolute -top-24 right-[-20%] h-64 w-64 rounded-full bg-premium/25 blur-3xl"
              />
            )}

            {/* Badge row */}
            <div className="relative flex items-center justify-between gap-3">
              <span
                className={`text-[10px] font-sans font-bold uppercase tracking-[0.24em] ${
                  t.accent ? "text-premium" : "text-muted-foreground"
                }`}
              >
                {t.tag}
              </span>
              {t.accent && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-premium px-3 py-1 text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-foreground shadow-lg shadow-premium/40">
                  <BadgeCheck className="h-3 w-3" aria-hidden />
                  Recommended
                </span>
              )}
            </div>

            {/* Name */}
            <h3 className="relative mt-5 font-display uppercase text-foreground text-4xl leading-none tracking-tight md:text-5xl">
              {t.name}
            </h3>

            {/* Price */}
            <div className="relative mt-6 flex items-end gap-2">
              {t.price !== "0" && (
                <span
                  className={`mb-3 font-display text-2xl leading-none ${
                    t.accent ? "text-premium" : "text-muted-foreground"
                  }`}
                >
                  $
                </span>
              )}
              <span
                className={`font-display leading-none tracking-tight text-[clamp(3.5rem,9vw,5.5rem)] ${
                  t.accent ? "text-foreground" : "text-foreground"
                }`}
              >
                {t.price === "0" ? "Free" : t.price}
              </span>
              <span className="mb-3 ml-1 text-xs font-sans font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {t.unit}
              </span>
            </div>

            {/* Divider */}
            <div
              className={`relative mt-7 h-px w-full ${
                t.accent ? "bg-gradient-to-r from-premium/60 via-white/10 to-transparent" : "bg-muted"
              }`}
            />

            {/* Body copy */}
            <p className="relative mt-6 text-sm font-sans leading-relaxed text-foreground/80 sm:text-base">
              {t.body}
            </p>

            {/* Features */}
            <ul className="relative mt-6 flex flex-col gap-3">
              {t.features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-3 text-sm font-sans text-foreground"
                >
                  <span
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                      t.accent
                        ? "bg-premium text-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <Check aria-hidden className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span className="leading-snug">{f}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <Link
              to={t.to}
              onClick={() => track("home_cta_click", { section: "pricing", tier: t.name })}
              className={`group/cta relative mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full py-4 text-sm font-sans font-bold uppercase tracking-[0.22em] transition-all duration-300 ${
                t.accent
                  ? "bg-premium text-foreground shadow-lg shadow-premium/30 hover:bg-foreground hover:text-background hover:shadow-xl hover:shadow-premium/40"
                  : "border border-border text-foreground hover:border-foreground hover:bg-foreground hover:text-background"
              }`}
            >
              {t.cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover/cta:translate-x-1" />
            </Link>

            {/* Fine print */}
            <p className="relative mt-4 text-center text-[10px] font-sans uppercase tracking-[0.2em] text-foreground/35">
              {t.accent ? "Cancel anytime · Pro-rated" : "No card required"}
            </p>
          </article>
        ))}
      </div>

      {/* Trust row */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[11px] font-sans uppercase tracking-[0.22em] text-foreground/45">
        <span className="inline-flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-premium" /> Secure payment</span>
        <span className="hidden h-3 w-px bg-white/15 sm:block" />
        <span className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-premium" strokeWidth={3} /> Cancel anytime</span>
        <span className="hidden h-3 w-px bg-white/15 sm:block" />
        <span className="inline-flex items-center gap-2"><Crown className="h-3.5 w-3.5 text-premium" /> Pro paid directly</span>
      </div>
    </section>
  );
}

/* ─────────────────────────  Final CTA  ───────────────────────── */

function FinalCtaSection() {
  const [ctaRef, seen] = useHasBeenInView<HTMLElement>("300px");
  useImpression(ctaRef, "final_cta");
  return (
    <section
      ref={ctaRef}
      aria-label="Join LEER"
      data-inview={seen ? "true" : "false"}
      className="relative isolate overflow-hidden border-t border-border bg-background"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(50% 60% at 20% 40%, color-mix(in oklch, var(--premium) 14%, transparent) 0%, transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
        <div className="grid grid-cols-1 border border-border lg:grid-cols-12">
          {/* Left: Headline + CTAs */}
          <div className="flex flex-col justify-between gap-16 border-b border-border p-8 sm:p-12 lg:col-span-7 lg:border-b-0 lg:border-r lg:p-16">
            <div>
              <span className="reveal inline-block bg-premium px-2 py-1 text-[10px] font-sans font-bold uppercase tracking-[0.28em] text-background">
                Restricted area
              </span>
              <h2
                className="reveal mt-8 font-display italic uppercase leading-[0.85] tracking-tighter text-foreground text-[clamp(2.5rem,9vw,7.5rem)]"
                style={{ ["--reveal-delay" as string]: "80ms" }}
              >
                Don&rsquo;t play
                <br />
                <span className="text-premium">catch up.</span>
              </h2>
            </div>
            <div
              className="reveal flex flex-col gap-3 sm:flex-row"
              style={{ ["--reveal-delay" as string]: "220ms" }}
            >
              <Link
                to="/signup"
                onClick={() => track("home_cta_click", { section: "final_cta", target: "signup" })}
                className="group inline-flex items-center justify-center gap-2 bg-premium px-8 py-4 text-xs font-sans font-bold uppercase tracking-[0.28em] text-background transition-all duration-300 hover:bg-foreground hover:text-background"
              >
                Create your account
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/feed"
                onClick={() => track("home_cta_click", { section: "final_cta", target: "browse" })}
                className="inline-flex items-center justify-center gap-2 border border-border px-8 py-4 text-xs font-sans font-bold uppercase tracking-[0.28em] text-foreground transition-all duration-300 hover:border-foreground hover:bg-foreground hover:text-background"
              >
                Browse trainers
              </Link>
            </div>
          </div>

          {/* Right: Newsletter */}
          <div className="flex flex-col justify-center bg-card p-8 sm:p-12 lg:col-span-5 lg:p-16">
            <div className="max-w-sm">
              <h3
                className="reveal font-display text-3xl italic uppercase tracking-tight text-foreground sm:text-4xl"
                style={{ ["--reveal-delay" as string]: "120ms" }}
              >
                Join the roster
              </h3>
              <p
                className="reveal mt-4 text-sm font-sans leading-relaxed text-foreground/55"
                style={{ ["--reveal-delay" as string]: "180ms" }}
              >
                Weekly training drills, professional insights, and restricted gear drops delivered to your inbox.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  track("home_cta_click", { section: "final_cta", target: "newsletter" });
                }}
                className="reveal mt-8"
                style={{ ["--reveal-delay" as string]: "240ms" }}
                aria-label="Newsletter signup"
              >
                <input
                  type="email"
                  required
                  placeholder="EMAIL ADDRESS"
                  className="w-full border-b-2 border-border bg-transparent py-4 text-sm font-sans font-bold uppercase tracking-[0.24em] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-premium"
                />
                <button
                  type="submit"
                  className="mt-6 w-full bg-foreground py-4 text-xs font-sans font-bold uppercase tracking-[0.28em] text-background transition-all duration-300 hover:bg-premium hover:text-background"
                >
                  Subscribe
                </button>
              </form>
              <p className="mt-6 text-[10px] font-sans uppercase leading-loose tracking-[0.24em] text-muted-foreground/70">
                By subscribing you agree to our{" "}
                <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">
                  Privacy Policy
                </Link>
                . No spam, only performance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
