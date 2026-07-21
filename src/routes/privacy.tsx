import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — leersports" },
      { name: "description", content: "How leersports collects, uses, and protects your personal data." },
      { property: "og:title", content: "Privacy Policy — leersports" },
      { property: "og:description", content: "How leersports collects, uses, and protects your personal data." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-emerald-500" />
          Last updated {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long" })}
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Privacy Policy
        </h1>
        <div className="prose prose-neutral dark:prose-invert mt-8 max-w-none text-muted-foreground">
          <p>
            leersports respects your privacy. This page explains what data we collect, how we use it,
            and the choices you have. This is a placeholder document — replace it with your finalized
            policy before launch.
          </p>
          <h2 className="mt-8 text-xl font-semibold text-foreground">Data we collect</h2>
          <p>Account information, booking history, and usage analytics.</p>
          <h2 className="mt-8 text-xl font-semibold text-foreground">How we use it</h2>
          <p>To operate the platform, personalize recommendations, and improve reliability.</p>
          <h2 className="mt-8 text-xl font-semibold text-foreground">Your rights</h2>
          <p>Access, export, correct, or delete your data at any time from Settings.</p>
        </div>
      </div>
    </main>
  );
}