import { Link } from "@tanstack/react-router";
import { Button } from "./ui/button";

export function CTASection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-navy px-6 py-16 text-center sm:px-12 lg:px-16">
          <h2 className="text-3xl font-bold tracking-tight text-navy-foreground sm:text-4xl">
            Ready to start training?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-navy-foreground/80">
            Join leersports today and book your first class. Whether you are learning a new sport or
            sharpening your skills, we have got you covered.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link to="/auth">
              <Button size="lg" variant="coral">
                Create free account
              </Button>
            </Link>
            <Link to="/classes">
              <Button size="lg" variant="outline" className="border-navy-foreground/30 text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground">
                Browse classes
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
