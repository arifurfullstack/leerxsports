import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — leersports" },
      { name: "description", content: "The terms and conditions that govern your use of leersports." },
      { property: "og:title", content: "Terms of Service — leersports" },
      { property: "og:description", content: "The terms and conditions that govern your use of leersports." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <ScrollText aria-hidden="true" className="h-3.5 w-3.5 text-sky-500" />
          Last updated {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long" })}
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Terms of Service
        </h1>
        <div className="prose prose-neutral dark:prose-invert mt-8 max-w-none text-muted-foreground">
          <p>
            By using leersports you agree to these terms. This is a placeholder document — replace it
            with your finalized terms before launch.
          </p>
          <h2 className="mt-8 text-xl font-semibold text-foreground">Accounts</h2>
          <p>You are responsible for the security of your account and the accuracy of your details.</p>
          <h2 className="mt-8 text-xl font-semibold text-foreground">Bookings and payments</h2>
          <p>Class bookings are subject to trainer availability and the cancellation policy shown at checkout.</p>
          <h2 className="mt-8 text-xl font-semibold text-foreground">Acceptable use</h2>
          <p>No harassment, unlawful content, or attempts to disrupt the service.</p>
        </div>
      </div>
    </main>
  );
}