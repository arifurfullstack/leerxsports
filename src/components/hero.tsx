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

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8 lg:py-40">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sport/40 bg-sport/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-sport mb-4 shadow-[0_0_12px_hsl(var(--sport)/0.3)]">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sport" />
            Pro Athlete &amp; Creator Platform
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Train with pros. <span className="text-sport">Level up.</span> Repeat.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Stream pro workout feeds, master technique with exclusive shorts, and receive direct 1-on-1 video feedback from world-class coaches.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to="/feed">
              <Button size="lg" className="bg-sport font-display font-bold uppercase tracking-wider text-black hover:bg-sport/90 shadow-[0_0_20px_-3px_hsl(var(--sport)/0.5)]">
                Explore Workouts
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="lg" variant="outline" className="border-white/20 bg-black/40 font-display font-bold uppercase tracking-wider text-white hover:bg-white/10 hover:border-white/40">
                Start Training Free
              </Button>
            </Link>
          </div>
          <div className="mt-6">
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
