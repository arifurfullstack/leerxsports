import { createFileRoute } from "@tanstack/react-router";
import { Dumbbell, Target, Heart } from "lucide-react";
import { RedirectIfAuthed } from "@/components/redirect-if-authed";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About leersports — Learn Sports from Coaches" },
      { name: "description", content: "leersports is a sports learning platform connecting athletes with certified coaches and classes." },
      { property: "og:title", content: "About leersports — Learn Sports from Coaches" },
      { property: "og:description", content: "leersports is a sports learning platform connecting athletes with certified coaches and classes." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <main className="min-h-dvh bg-background">
      <RedirectIfAuthed />
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          About leersports
        </h1>
        <p className="mt-6 text-lg text-muted-foreground">
          leersports is a modern sports learning platform built to help athletes of all levels find
          the right class, coach, and community. Whether you are picking up a new sport or refining
          your technique, we make it easy to book sessions, track progress, and stay motivated.
        </p>

        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sport/10 text-sport">
              <Dumbbell className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-card-foreground">Expert coaching</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Learn from experienced instructors who know how to teach safely and effectively.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sport/10 text-sport">
              <Target className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-card-foreground">Every level</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Beginner fundamentals, intermediate drills, and advanced training in one place.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sport/10 text-sport">
              <Heart className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-card-foreground">Community first</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Connect with fellow athletes and build healthy habits that last.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
