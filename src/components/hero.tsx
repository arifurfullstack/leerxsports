import { Link } from "@tanstack/react-router";
import { Button } from "./ui/button";
import heroImage from "../../public/images/hero.jpg";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          src={heroImage}
          alt="Athletes training at sunset across swimming, running, cycling and martial arts"
          className="h-full w-full object-cover"
          width={1440}
          height={720}
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/40" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-24 lg:px-8 lg:py-36">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sport/40 bg-sport/10 px-3 py-1 font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.24em] sm:tracking-[0.28em] text-sport mb-3 sm:mb-4 shadow-[0_0_12px_hsl(var(--sport)/0.3)]">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sport" />
            Pro Athlete &amp; Creator Platform
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-[1.1] sm:leading-tight">
            Train with pros. <span className="text-sport">Level up.</span> Repeat.
          </h1>
          <p className="mt-4 sm:mt-6 text-sm sm:text-lg text-muted-foreground leading-relaxed">
            Stream pro workout feeds, master technique with exclusive shorts, and receive direct 1-on-1 video feedback from world-class coaches.
          </p>
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <Link to="/feed" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto bg-sport font-display font-bold uppercase tracking-wider text-black hover:bg-sport/90 shadow-[0_0_20px_-3px_hsl(var(--sport)/0.5)]">
                Explore Workouts
              </Button>
            </Link>
            <Link to="/signup" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/20 bg-black/40 font-display font-bold uppercase tracking-wider text-white hover:bg-white/10 hover:border-white/40">
                Start Training Free
              </Button>
            </Link>
          </div>
          <div className="mt-5 sm:mt-6">
            <Link
              to="/signup"
              search={{ role: "trainer" } as any}
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sport/90 hover:text-sport transition-colors"
            >
              <span>Are you a coach or athlete?</span>
              <span className="underline underline-offset-4">Apply to Monetize &amp; Coach →</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
