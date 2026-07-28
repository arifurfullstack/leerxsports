import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Flame, Globe2, ShieldCheck, ArrowRight, Play, Star, Zap, Dumbbell, LineChart, Clapperboard } from "lucide-react";
import { useEffect, useState } from "react";
import { useLowPowerMode, useInView, useHasBeenInView } from "@/hooks/use-hero-perf";
import { HomeSections } from "@/components/home-sections";
import { track, useScrollDepth } from "@/lib/analytics";
import { RedirectIfAuthed } from "@/components/redirect-if-authed";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LEER Sports — Fitness Is The Only Law" },
      { name: "description", content: "Restricted area for elite creators and premium fans. Discover verified pro creators, unlock premium workouts, and get personalized video coaching every month." },
      { property: "og:title", content: "LEER Sports — Fitness Is The Only Law" },
      { property: "og:description", content: "Restricted area for elite creators and premium fans." },
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
    <div ref={heroRef} className="relative isolate overflow-hidden bg-[#000000] text-foreground">
      <RedirectIfAuthed />
      {/* Client PDF Spec: 100% Solid Deep Black (#000000) with subtle Neon Red centerpiece glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[#000000]">
        <div
          className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-premium/15 blur-[120px]"
        />
      </div>

      <section
        data-hero
        aria-label="Hero"
        className="hero-scope relative mx-auto flex max-w-6xl flex-col items-center px-4 text-center sm:px-6 lg:px-8 pt-[clamp(3.5rem,5.5vw+1rem,6.5rem)] pb-[clamp(4rem,6vw+1rem,7rem)]"
      >
        {/* Announcement pill */}
        <div className="mb-[clamp(1.5rem,2.5vw+0.5rem,2.5rem)] overflow-hidden">
          <Link
            to="/feed"
            className="group hero-reveal type-eyebrow inline-flex items-center gap-2.5 rounded-full border border-hairline-strong bg-card/70 px-3.5 py-1.5 font-semibold text-muted-foreground backdrop-blur outline-none transition-[color,border-color,transform] duration-200 hover:border-premium/60 hover:text-foreground focus-visible:border-premium/70 focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-premium/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:hover:-translate-y-px"
            style={{ animationDelay: "80ms" }}
          >
            <span className="relative flex h-2 w-2">
              {animateBg && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-premium/70 motion-reduce:hidden" />
              )}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-premium" />
            </span>
            <span>New Drop · Verified Creators Live</span>
            <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Headline */}
        <h1
          aria-label="Fitness Is The Only Law"
          className="group/headline type-display font-display uppercase italic text-foreground mx-auto max-w-[9ch] leading-[0.92] sm:max-w-[12ch] sm:leading-[0.9] md:max-w-[14ch] md:leading-[0.88] lg:max-w-[16ch] lg:leading-[0.86]"
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
              className="hero-reveal type-display-tight block"
              style={{ animationDelay: "420ms" }}
            >
              <span className="text-foreground">The&nbsp;Only </span>
              <span className="inline-block text-premium transition-transform duration-500 ease-out motion-safe:group-hover/headline:-translate-y-0.5 motion-safe:group-hover/headline:scale-[1.03]">
                Law.
              </span>
            </span>
          </span>
        </h1>

        {/* Sub-copy per Client PDF Spec */}
        <p
          className="hero-reveal type-lead mt-[clamp(1rem,1.5vw+0.5rem,2rem)] max-w-[34ch] text-balance font-medium leading-[1.5] text-muted-foreground sm:max-w-xl"
          style={{ animationDelay: "620ms" }}
        >
          <span className="font-bold tracking-widest text-premium uppercase">RESTRICTED AREA.</span> Exclusive space for elite creators and premium members.
        </p>

        {/* CTAs */}
        <div
          className="hero-reveal mx-auto mt-[clamp(1.75rem,2.5vw+0.75rem,2.75rem)] grid w-full max-w-md grid-cols-1 gap-3 sm:max-w-xl sm:grid-cols-2 md:flex md:w-auto md:max-w-none md:flex-row md:flex-wrap md:items-center md:justify-center md:gap-4"
          style={{ animationDelay: "780ms" }}
        >
          <Link
            to="/auth"
            className="group relative inline-flex h-12 w-full items-center justify-center overflow-hidden rounded-none bg-primary px-7 font-display text-sm uppercase tracking-[0.28em]! text-primary-foreground outline-none transition-transform duration-200 hover:bg-premium hover:text-premium-foreground focus-visible:ring-2 focus-visible:ring-premium focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 md:h-14 md:w-auto md:shrink-0 md:px-9"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition-[transform,opacity] duration-700 ease-out motion-safe:group-hover:translate-x-[420%] motion-safe:group-hover:opacity-100 motion-reduce:hidden"
            />
            <span className="relative whitespace-nowrap">Shop The Platform</span>
            <ArrowRight className="relative ml-2 h-4 w-4 shrink-0 transition-transform duration-300 ease-out group-hover:translate-x-1" aria-hidden="true" />
          </Link>
          <Link
            to="/trainers"
            className="group relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-none border border-foreground/70 bg-transparent px-7 font-display text-sm uppercase tracking-[0.28em]! text-foreground outline-none transition-[color,border-color,transform] duration-300 hover:border-foreground hover:text-background focus-visible:ring-2 focus-visible:ring-foreground/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:hover:-translate-y-0.5 md:h-14 md:w-auto md:shrink-0 md:px-9"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 origin-left scale-x-0 bg-foreground transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:group-hover:scale-x-100 motion-reduce:group-hover:scale-x-100"
            />
            <Play className="relative h-4 w-4 shrink-0 fill-current transition-transform duration-300 ease-out motion-safe:group-hover:scale-110 motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
            <span className="relative whitespace-nowrap">Explore Creators</span>
          </Link>
        </div>

        {/* Trust row */}
        <div
          className="hero-reveal mt-[clamp(2rem,3vw+0.75rem,3rem)] flex flex-wrap items-center justify-center gap-x-6 gap-y-3 leading-[1.4] text-xs text-muted-foreground"
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
  * Uses semantic dark tokens: card / background / border / premium (neon-red).
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
            className="tile-anim group relative col-span-4 flex min-h-[200px] flex-col justify-center overflow-hidden rounded-3xl bg-premium p-7 sm:p-8 md:col-span-4 lg:col-span-4 lg:min-h-0"
            style={{ ["--tile-delay" as string]: "0ms" }}
          >
            <Zap
              aria-hidden
              className="pointer-events-none absolute -right-4 -bottom-4 h-32 w-32 text-premium-foreground/25 transition-transform duration-500 motion-safe:group-hover:scale-110"
              strokeWidth={1.5}
            />
            <span className="type-eyebrow mb-2 font-sans font-semibold text-premium-foreground/85">
              Total Impact
            </span>
            <div className="type-metric font-display uppercase text-premium-foreground">
              12K+
            </div>
            <p className="type-tile mt-2 font-display uppercase text-foreground/90">
              Elite Sessions
            </p>
          </article>

          {/* HERO FEATURE — Elite Content (tall) */}
          <article
            className="tile-anim group relative col-span-4 flex min-h-[340px] flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-7 hover:border-premium/50 sm:p-8 md:col-span-4 md:row-span-2 md:min-h-[360px] lg:col-span-4 lg:row-span-2 lg:min-h-0"
            style={{ ["--tile-delay" as string]: "80ms" }}
          >
            <div className="relative z-10">
              <div className="mb-6 grid h-12 w-12 place-items-center rounded-xl bg-muted transition-colors duration-300 group-hover:bg-premium">
                <Flame className="h-6 w-6 text-premium transition-colors duration-300 group-hover:text-premium-foreground" />
              </div>
              <h3 className="type-tile-lg font-display uppercase text-foreground">
                Elite Content
              </h3>
              <p className="type-small mt-3 font-sans text-muted-foreground">
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
                className="group/mini relative flex aspect-square min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-border bg-background/70 p-1.5 transition-all duration-200 outline-none hover:-translate-y-1 hover:border-premium/70 hover:bg-background hover:shadow-lg hover:shadow-premium/10 focus-visible:ring-2 focus-visible:ring-premium/70 focus-visible:ring-offset-2 focus-visible:ring-offset-card active:translate-y-0 active:scale-[0.97] sm:gap-1.5 sm:rounded-xl sm:p-2"
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-premium/10 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover/mini:opacity-100 group-focus-visible/mini:opacity-100" />
                <Icon className="h-5 w-5 text-premium transition-transform duration-200 group-hover/mini:scale-110 group-focus-visible/mini:scale-110 sm:h-7 sm:w-7" strokeWidth={1.75} />
                <span className="truncate max-w-full text-[8px] font-sans font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors duration-200 group-hover/mini:text-foreground/90 group-focus-visible/mini:text-foreground/90 sm:text-[10px] sm:tracking-[0.18em]">
                  {label}
                </span>
              </button>
            ))}
            </div>
          </article>

          {/* FEATURE — Verified Pros (wide) */}
          <article
            className="tile-anim group col-span-4 flex min-h-[140px] items-center gap-5 rounded-3xl border border-border bg-card p-6 hover:border-premium/50 sm:p-7 md:col-span-4 lg:col-span-4 lg:min-h-0"
            style={{ ["--tile-delay" as string]: "160ms" }}
          >
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-border bg-background sm:h-16 sm:w-16">
              <ShieldCheck className="h-7 w-7 text-premium sm:h-8 sm:w-8" />
            </div>
            <div className="min-w-0">
              <h3 className="type-tile font-display uppercase text-foreground">
                Verified Pros
              </h3>
              <p className="type-eyebrow mt-1.5 font-sans text-muted-foreground" style={{ letterSpacing: "0.16em" }}>
                Certificates &amp; identity checks on 100% of trainers.
              </p>
            </div>
          </article>

          {/* STAT — 500+ Trainers */}
          <article
            className="tile-anim col-span-2 flex min-h-[160px] flex-col items-center justify-center rounded-3xl border border-border bg-card p-5 text-center hover:border-premium/50 sm:p-6 md:col-span-2 lg:col-span-2 lg:min-h-0"
            style={{ ["--tile-delay" as string]: "220ms" }}
          >
            <div className="type-metric-sm font-display uppercase text-premium">
              500+
            </div>
            <p className="type-eyebrow mt-2 font-display text-muted-foreground">
              Trainers
            </p>
          </article>

          {/* STAT — 40+ Countries */}
          <article
            className="tile-anim col-span-2 flex min-h-[160px] flex-col items-center justify-center rounded-3xl border border-border bg-card p-5 text-center hover:border-premium/50 sm:p-6 md:col-span-2 lg:col-span-2 lg:min-h-0"
            style={{ ["--tile-delay" as string]: "280ms" }}
          >
            <div className="type-metric-sm font-display uppercase text-foreground">
              40+
            </div>
            <p className="type-eyebrow mt-2 font-display text-muted-foreground">
              Countries
            </p>
          </article>

          {/* FEATURE — Global · Multilingual */}
          <article
            className="tile-anim group col-span-4 flex min-h-[180px] flex-col justify-between gap-4 rounded-3xl border border-border bg-card p-6 hover:border-premium/50 sm:p-7 md:col-span-4 lg:col-span-4 lg:min-h-0"
            style={{ ["--tile-delay" as string]: "340ms" }}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="type-tile-lg font-display uppercase text-foreground">
                Global · Multilingual
              </h3>
              <Globe2
                aria-hidden
                className="h-6 w-6 shrink-0 text-muted-foreground transition-colors group-hover:text-premium"
              />
            </div>
            <p className="type-small font-sans text-muted-foreground">
              Discover by specialty with built-in text translation for every session.
            </p>
          </article>

          {/* FEATURE — Video Coaching */}
          <article
            className="tile-anim col-span-4 flex min-h-[160px] items-start gap-4 rounded-3xl border border-border bg-gradient-to-br from-card to-background p-6 hover:border-premium/50 sm:p-7 md:col-span-4 lg:col-span-4 lg:min-h-0"
            style={{ ["--tile-delay" as string]: "400ms" }}
          >
            <div className="relative mt-1.5 flex h-3 w-3 shrink-0">
              {animate && (
                <span aria-hidden className="absolute inline-flex h-full w-full rounded-full bg-premium/60 motion-safe:animate-ping motion-reduce:hidden" />
              )}
              <span aria-hidden className="relative inline-flex h-3 w-3 rounded-full bg-premium" />
            </div>
            <div className="min-w-0">
              <h3 className="type-tile font-display uppercase text-foreground">
                Video Coaching
              </h3>
              <p className="type-small mt-1.5 font-sans text-muted-foreground">
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
              className={`skeleton-tile ${s.c} ${s.h} rounded-3xl border border-border/60 bg-card/40`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
