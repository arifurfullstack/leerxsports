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
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Learn sports. <span className="text-sport">Level up.</span> Repeat.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Book expert-led classes in swimming, cycling, martial arts, team sports and more. Train
            at your pace, track your progress, and find your next challenge.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/feed">
              <Button size="lg">Browse classes</Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
