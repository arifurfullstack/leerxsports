import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageSquare, MapPin } from "lucide-react";
import { RedirectIfAuthed } from "@/components/redirect-if-authed";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact leersports — Get in Touch" },
      { name: "description", content: "Reach the leersports team for support, partnerships, or press enquiries." },
      { property: "og:title", content: "Contact leersports — Get in Touch" },
      { property: "og:description", content: "Reach the leersports team for support, partnerships, or press enquiries." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <main className="min-h-dvh bg-background">
      <RedirectIfAuthed />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Get in touch
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Questions, partnerships, or press — we&apos;d love to hear from you.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <a
            href="mailto:hello@leersports.example"
            className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-sky-500/40 hover:bg-sky-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Mail aria-hidden="true" className="h-5 w-5 text-sky-500" />
            <h2 className="mt-3 font-semibold text-foreground">Email</h2>
            <p className="mt-1 text-sm text-muted-foreground">hello@leersports.example</p>
          </a>
          <a
            href="mailto:support@leersports.example"
            className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-fuchsia-500/40 hover:bg-fuchsia-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <MessageSquare aria-hidden="true" className="h-5 w-5 text-fuchsia-500" />
            <h2 className="mt-3 font-semibold text-foreground">Support</h2>
            <p className="mt-1 text-sm text-muted-foreground">support@leersports.example</p>
          </a>
          <div className="rounded-2xl border border-border bg-card p-5">
            <MapPin aria-hidden="true" className="h-5 w-5 text-orange-500" />
            <h2 className="mt-3 font-semibold text-foreground">HQ</h2>
            <p className="mt-1 text-sm text-muted-foreground">Remote-first, worldwide</p>
          </div>
        </div>
      </div>
    </main>
  );
}