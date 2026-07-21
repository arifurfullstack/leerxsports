import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Flame, Globe2, ShieldCheck, Sparkles, ArrowRight, Play, Star, Zap, Dumbbell, LineChart, Clapperboard } from "lucide-react";
import { useEffect, useState } from "react";
import { useLowPowerMode, useInView, useHasBeenInView } from "@/hooks/use-hero-perf";
import { HomeSections } from "@/components/home-sections";
import { track, useScrollDepth } from "@/lib/analytics";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LEER Sports — Fitness Is The Only Law" },
      { name: "description", content: "Restricted area for elite creators and premium members. Discover verified pro trainers, unlock premium workouts, and get personalized video coaching every month." },
      { property: "og:title", content: "LEER Sports — Fitness Is The Only Law" },
      { property: "og:description", content: "Restricted area for elite creators and premium members." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

function Index() {
  const lowPower = useLowPowerMode();
  const [heroRef, heroInView] = useInView<HTMLDivElement>("200px");
  useScrollDepth("home");
  useEffect(() => {
    track("page_view", { page: "home" });
  }, []);
  // Pause blob/pulse animations when hero is offscreen or on constrained devices.
  const animateBg = heroInView && !lowPower;
  return (
    <div ref={heroRef} className="relative isolate overflow-hidden bg-background text-foreground">
      {/* Ambient background: layered gradients + grid + blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(55% 45% at 20% 20%, color-mix(in oklch, var(--primary) 28%, transparent) 0%, transparent 65%), radial-gradient(45% 40% at 85% 15%, color-mix(in oklch, #f472b6 22%, transparent) 0%, transparent 70%), radial-gradient(50% 45% at 70% 90%, color-mix(in oklch, #38bdf8 20%, transparent) 0%, transparent 70%)",
          }}
        />
        {!lowPower && (
          <div
            className="absolute inset-0 opacity-[0.15] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]"
            style={{
              backgroundImage:
                "linear-gradient(to right, color-mix(in oklch, var(--foreground) 12%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--foreground) 12%, transparent) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
        )}
        <div
          className={`absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/20 ${lowPower ? "blur-2xl" : "blur-3xl"} ${animateBg ? "motion-safe:animate-pulse" : ""}`}
        />
        {!lowPower && (
          <div
            className={`absolute top-40 -right-20 h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl ${animateBg ? "motion-safe:animate-pulse [animation-delay:1s]" : ""}`}
          />
        )}
      </div>

      <section
        data-hero
        aria-label="Hero"
        className="hero-scope relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-20 pt-14 text-center sm:px-6 sm:pt-20 lg:pt-24"
      >
        {/* Announcement pill */}
        <div className="mb-8 overflow-hidden">
          <Link
            to="/browse"
            className="group hero-reveal type-eyebrow inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 font-semibold italic text-muted-foreground backdrop-blur outline-none transition-[color,border-color,box-shadow,transform] duration-200 hover:border-primary/60 hover:text-foreground focus-visible:border-primary/70 focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98]"
            style={{ animationDelay: "80ms" }}
          >
            <span className="relative flex h-2 w-2">
              {animateBg && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 motion-reduce:hidden" />
              )}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            New · Verified Trainers Are Live
            <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Headline */}
        <h1
          aria-label="Fitness Is The Only Law"
          className="type-display font-display uppercase italic text-foreground mx-auto max-w-[14ch] sm:max-w-[16ch] md:max-w-[18ch] lg:max-w-[20ch]"
        >
          <span aria-hidden="true" className="block overflow-hidden pb-[0.08em]">
            <span
              className="hero-reveal type-display-airy block whitespace-nowrap"
              style={{ animationDelay: "220ms" }}
            >
              {"Fitness\u00A0Is"}
            </span>
          </span>
          <span aria-hidden="true" className="relative block overflow-hidden pb-[0.08em]">
            <span
              className="hero-reveal type-display-tight block whitespace-nowrap"
              style={{ animationDelay: "420ms" }}
            >
              <span className="hero-sweep inline-block">{"The\u00A0Only\u00A0Law"}</span>
            </span>
            <Sparkles
              aria-hidden
              className={`pointer-events-none absolute right-2 top-1 h-5 w-5 text-fuchsia-400 sm:right-6 sm:top-2 sm:h-7 sm:w-7 ${animateBg ? "motion-safe:animate-pulse" : ""}`}
            />
          </span>
        </h1>

        {/* Sub-copy */}
        <p
          className="hero-reveal type-lead mt-6 max-w-2xl text-balance font-medium text-muted-foreground sm:mt-8"
          style={{ animationDelay: "620ms" }}
        >
          An exclusive space for elite creators and premium members. Discover verified pro
          trainers, unlock elite content, and get{" "}
          <span className="text-foreground">personalized video coaching</span> every month.
        </p>

        {/* CTAs */}
        <div
          className="hero-reveal mt-8 flex w-full max-w-md flex-col items-stretch gap-3 sm:mt-10 sm:w-auto sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center"
          style={{ animationDelay: "780ms" }}
        >
          <Link
            to="/auth"
            className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full bg-primary px-6 font-display text-sm uppercase tracking-[0.32em]! [word-spacing:0.15em]! text-primary-foreground shadow-lg shadow-primary/30 outline-none transition-[box-shadow,transform] duration-200 hover:shadow-xl hover:shadow-primary/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98] sm:shrink-0 sm:px-8"
          >
            <span className="absolute inset-0 -z-10 bg-gradient-to-r from-primary via-fuchsia-500 to-orange-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <span className="whitespace-nowrap">Enter The Platform</span>
            <ArrowRight className="ml-2 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
          <Link
            to="/trainers"
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-card/60 px-6 font-display text-sm uppercase tracking-[0.32em]! [word-spacing:0.15em]! text-foreground backdrop-blur outline-none transition-[color,border-color,box-shadow,transform] duration-200 hover:border-primary/60 hover:text-primary focus-visible:border-primary/70 focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98] sm:shrink-0 sm:px-8"
          >
            <Play className="h-4 w-4 shrink-0 fill-current transition-transform duration-200 motion-safe:group-hover:scale-110" aria-hidden="true" />
            <span className="whitespace-nowrap">Explore Trainers</span>
          </Link>
        </div>

        {/* Trust row */}
        <div
          className="hero-reveal mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-muted-foreground sm:mt-12"
          style={{ animationDelay: "920ms" }}
        >
          <div className="group/trust flex items-center gap-2">
            <div className="flex -space-x-2">
              {["from-primary to-fuchsia-500", "from-fuchsia-500 to-orange-400", "from-orange-400 to-primary", "from-sky-400 to-primary"].map((g, i) => (
                <div
                  key={i}
                  className={`h-7 w-7 rounded-full border-2 border-background bg-gradient-to-br ${g} transition-transform duration-300 motion-safe:group-hover/trust:-translate-y-0.5`}
                  style={{ transitionDelay: `${i * 40}ms` }}
                />
              ))}
            </div>
            <span><span className="font-semibold text-foreground">10k+</span> athletes</span>
          </div>
          <div className="hidden h-4 w-px bg-border sm:block" />
          <div className="group/rating flex items-center gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star
                key={i}
                className="h-3.5 w-3.5 fill-amber-400 text-amber-400 transition-transform duration-300 motion-safe:group-hover/rating:scale-110"
                style={{ transitionDelay: `${i * 30}ms` }}
              />
            ))}
            <span className="ml-1"><span className="font-semibold text-foreground">4.9</span>/5 rating</span>
          </div>
          <div className="hidden h-4 w-px bg-border sm:block" />
          <div className="group/verified flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400 transition-transform duration-300 motion-safe:group-hover/verified:scale-110" />
            <span>ID-verified pros</span>
          </div>
        </div>

      </section>

      <KineticBento />
      <HomeSections />
    </div>
  );
}

/**
 * Kinetic bento — unified stats + features composition (below hero).
 * Locked palette: Charcoal & Ember (#1a1a1a / #2d2d2d / #4a4a4a / #e85d3a).
 * Lazy-mounts once in view to skip below-fold work on initial render.
 */
function KineticBento() {
  const [ref, seen] = useHasBeenInView<HTMLElement>("300px");
  // Track live viewport intersection so per-frame animations (ping,
  // pulse) only run while the section is actually on screen.
  const [inViewRef, inView] = useInView<HTMLDivElement>("100px");
  const lowPower = useLowPowerMode();
  const animate = inView && !lowPower;
  // Small hold on the skeleton so extremely-fast intersections don't cause
  // a single-frame flash before the crossfade. Kept short (120ms) to feel
  // instant on capable devices.
  const [showContent, setShowContent] = useState(false);
  useEffect(() => {
    if (!seen) return;
    const t = setTimeout(() => setShowContent(true), 120);
    return () => clearTimeout(t);
  }, [seen]);
  return (
    <section
      ref={ref}
      aria-label="Platform highlights"
      aria-busy={!showContent}
      className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6"
      style={{ contentVisibility: "auto", containIntrinsicSize: "1px 900px" }}
    >
      {showContent ? (
        <div
          ref={inViewRef}
          className="section-fade-in grid grid-cols-4 gap-4 sm:gap-5 md:grid-cols-8 md:gap-5 lg:grid-cols-12 lg:auto-rows-[172px]"
        >
          {/* HERO STAT — 12K+ Elite Sessions */}
          <article
            className="tile-anim group relative col-span-4 flex min-h-[200px] flex-col justify-center overflow-hidden rounded-3xl bg-[#e85d3a] p-7 sm:p-8 md:col-span-4 lg:col-span-4 lg:min-h-0"
            style={{ ["--tile-delay" as string]: "0ms" }}
          >
            <Zap
              aria-hidden
              className="pointer-events-none absolute -right-4 -bottom-4 h-32 w-32 text-white/20 transition-transform duration-500 motion-safe:group-hover:scale-110"
              strokeWidth={1.5}
            />
            <span className="type-eyebrow mb-2 font-sans font-semibold text-white/80">
              Total Impact
            </span>
            <div className="type-metric font-display uppercase text-white">
              12K+
            </div>
            <p className="type-tile mt-2 font-display uppercase text-white/90">
              Elite Sessions
            </p>
          </article>

          {/* HERO FEATURE — Elite Content (tall) */}
          <article
            className="tile-anim group relative col-span-4 flex min-h-[340px] flex-col justify-between overflow-hidden rounded-3xl border border-[#4a4a4a] bg-[#2d2d2d] p-7 hover:border-[#e85d3a]/50 sm:p-8 md:col-span-4 md:row-span-2 md:min-h-[360px] lg:col-span-4 lg:row-span-2 lg:min-h-0"
            style={{ ["--tile-delay" as string]: "80ms" }}
          >
            <div className="relative z-10">
              <div className="mb-6 grid h-12 w-12 place-items-center rounded-xl bg-[#4a4a4a] transition-colors duration-300 group-hover:bg-[#e85d3a]">
                <Flame className="h-6 w-6 text-[#e85d3a] transition-colors duration-300 group-hover:text-white" />
              </div>
              <h3 className="type-tile-lg font-display uppercase text-white">
                Elite Content
              </h3>
              <p className="type-small mt-3 font-sans text-neutral-400">
                Instagram-style feed of premium workouts, transformations, and technique breakdowns from the world's best.
              </p>
            </div>
            <div role="group" aria-label="Elite content categories" className="mt-6 grid grid-cols-3 gap-1.5 xs:gap-2 sm:gap-3">
            {[
              { Icon: Dumbbell, label: "Workouts" },
              { Icon: LineChart, label: "Progress" },
              { Icon: Clapperboard, label: "Technique" },
            ].map(({ Icon, label }) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                className="group/mini relative flex aspect-square min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-[#4a4a4a] bg-[#1a1a1a]/70 p-1.5 transition-all duration-200 outline-none hover:-translate-y-1 hover:border-[#e85d3a]/70 hover:bg-[#1a1a1a] hover:shadow-lg hover:shadow-[#e85d3a]/10 focus-visible:ring-2 focus-visible:ring-[#e85d3a]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#2d2d2d] active:translate-y-0 active:scale-[0.97] sm:gap-1.5 sm:rounded-xl sm:p-2"
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#e85d3a]/10 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover/mini:opacity-100 group-focus-visible/mini:opacity-100" />
                <Icon className="h-5 w-5 text-[#e85d3a] transition-transform duration-200 group-hover/mini:scale-110 group-focus-visible/mini:scale-110 sm:h-7 sm:w-7" strokeWidth={1.75} />
                <span className="truncate max-w-full text-[8px] font-sans font-semibold uppercase tracking-[0.14em] text-neutral-400 transition-colors duration-200 group-hover/mini:text-white/90 group-focus-visible/mini:text-white/90 sm:text-[10px] sm:tracking-[0.18em]">
                  {label}
                </span>
              </button>
            ))}
            </div>
          </article>

          {/* FEATURE — Verified Pros (wide) */}
          <article
            className="tile-anim group col-span-4 flex min-h-[140px] items-center gap-5 rounded-3xl border border-[#4a4a4a] bg-[#2d2d2d] p-6 hover:border-[#e85d3a]/50 sm:p-7 md:col-span-4 lg:col-span-4 lg:min-h-0"
            style={{ ["--tile-delay" as string]: "160ms" }}
          >
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-[#4a4a4a] bg-[#1a1a1a] sm:h-16 sm:w-16">
              <ShieldCheck className="h-7 w-7 text-[#e85d3a] sm:h-8 sm:w-8" />
            </div>
            <div className="min-w-0">
              <h3 className="type-tile font-display uppercase text-white">
                Verified Pros
              </h3>
              <p className="type-eyebrow mt-1.5 font-sans text-neutral-400" style={{ letterSpacing: "0.16em" }}>
                Certificates &amp; identity checks on 100% of trainers.
              </p>
            </div>
          </article>

          {/* STAT — 500+ Trainers */}
          <article
            className="tile-anim col-span-2 flex min-h-[160px] flex-col items-center justify-center rounded-3xl border border-[#4a4a4a] bg-[#2d2d2d] p-5 text-center hover:border-[#e85d3a]/50 sm:p-6 md:col-span-2 lg:col-span-2 lg:min-h-0"
            style={{ ["--tile-delay" as string]: "220ms" }}
          >
            <div className="type-metric-sm font-display uppercase text-[#e85d3a]">
              500+
            </div>
            <p className="type-eyebrow mt-2 font-display text-neutral-400">
              Trainers
            </p>
          </article>

          {/* STAT — 40+ Countries */}
          <article
            className="tile-anim col-span-2 flex min-h-[160px] flex-col items-center justify-center rounded-3xl border border-[#4a4a4a] bg-[#2d2d2d] p-5 text-center hover:border-[#e85d3a]/50 sm:p-6 md:col-span-2 lg:col-span-2 lg:min-h-0"
            style={{ ["--tile-delay" as string]: "280ms" }}
          >
            <div className="type-metric-sm font-display uppercase text-white">
              40+
            </div>
            <p className="type-eyebrow mt-2 font-display text-neutral-400">
              Countries
            </p>
          </article>

          {/* FEATURE — Global · Multilingual */}
          <article
            className="tile-anim group col-span-4 flex min-h-[180px] flex-col justify-between gap-4 rounded-3xl border border-[#4a4a4a] bg-[#2d2d2d] p-6 hover:border-[#e85d3a]/50 sm:p-7 md:col-span-4 lg:col-span-4 lg:min-h-0"
            style={{ ["--tile-delay" as string]: "340ms" }}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="type-tile-lg font-display uppercase text-white">
                Global · Multilingual
              </h3>
              <Globe2
                aria-hidden
                className="h-6 w-6 shrink-0 text-[#4a4a4a] transition-colors group-hover:text-[#e85d3a]"
              />
            </div>
            <p className="type-small font-sans text-neutral-400">
              Discover by specialty with built-in text translation for every session.
            </p>
          </article>

          {/* FEATURE — Video Coaching */}
          <article
            className="tile-anim col-span-4 flex min-h-[160px] items-start gap-4 rounded-3xl border border-[#4a4a4a] bg-gradient-to-br from-[#2d2d2d] to-[#1a1a1a] p-6 hover:border-[#e85d3a]/50 sm:p-7 md:col-span-4 lg:col-span-4 lg:min-h-0"
            style={{ ["--tile-delay" as string]: "400ms" }}
          >
            <div className="relative mt-1.5 flex h-3 w-3 shrink-0">
              {animate && (
                <span aria-hidden className="absolute inline-flex h-full w-full rounded-full bg-[#e85d3a]/60 motion-safe:animate-ping motion-reduce:hidden" />
              )}
              <span aria-hidden className="relative inline-flex h-3 w-3 rounded-full bg-[#e85d3a]" />
            </div>
            <div className="min-w-0">
              <h3 className="type-tile font-display uppercase text-white">
                Video Coaching
              </h3>
              <p className="type-small mt-1.5 font-sans text-neutral-400">
                One private video-feedback session per month included in every subscription.
              </p>
            </div>
          </article>
        </div>
      ) : (
        <div
          className="grid grid-cols-4 gap-4 sm:gap-5 md:grid-cols-8 md:gap-5 lg:grid-cols-12 lg:auto-rows-[172px]"
          role="status"
          aria-label="Loading platform highlights"
        >
          <span className="sr-only">Loading platform highlights…</span>
          {[
            { c: "col-span-4 md:col-span-4 lg:col-span-4", h: "min-h-[200px]" },
            { c: "col-span-4 md:col-span-4 md:row-span-2 lg:col-span-4 lg:row-span-2", h: "min-h-[340px] md:min-h-[360px] lg:min-h-0" },
            { c: "col-span-4 md:col-span-4 lg:col-span-4", h: "min-h-[140px]" },
            { c: "col-span-2 md:col-span-2 lg:col-span-2", h: "min-h-[160px]" },
            { c: "col-span-2 md:col-span-2 lg:col-span-2", h: "min-h-[160px]" },
            { c: "col-span-4 md:col-span-4 lg:col-span-4", h: "min-h-[180px]" },
            { c: "col-span-4 md:col-span-4 lg:col-span-4", h: "min-h-[160px]" },
          ].map((s, i) => (
            <div
              key={i}
              aria-hidden
              className={`skeleton-tile ${s.c} ${s.h} rounded-3xl border border-[#4a4a4a]/40 bg-[#2d2d2d]/30`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
