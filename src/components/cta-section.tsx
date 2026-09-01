import { Link } from "@tanstack/react-router";
import { Button } from "./ui/button";

export function CTASection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-navy px-6 py-16 text-center sm:px-12 lg:px-16">
          <h2 className="text-3xl font-bold tracking-tight text-navy-foreground sm:text-4xl font-display uppercase">
            Ready to elevate your training?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-navy-foreground/80 leading-relaxed">
            Join thousands of athletes learning from elite coaches. Stream pro workout feeds, unlock masterclasses, and get direct 1-on-1 video coaching.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="bg-sport font-display font-bold uppercase tracking-wider text-black hover:bg-sport/90 shadow-[0_0_20px_-3px_hsl(var(--sport)/0.5)]">
                Create Free Account
              </Button>
            </Link>
            <Link to="/feed">
              <Button size="lg" variant="outline" className="border-navy-foreground/30 text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground font-display font-bold uppercase tracking-wider">
                Explore Workouts
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
