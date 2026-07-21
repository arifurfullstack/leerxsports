import { createFileRoute } from "@tanstack/react-router";
import { Cookie } from "lucide-react";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — leersports" },
      { name: "description", content: "How leersports uses cookies and similar technologies." },
      { property: "og:title", content: "Cookie Policy — leersports" },
      { property: "og:description", content: "How leersports uses cookies and similar technologies." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Cookie aria-hidden="true" className="h-3.5 w-3.5 text-amber-500" />
          Last updated {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long" })}
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Cookie Policy
        </h1>
        <div className="prose prose-neutral dark:prose-invert mt-8 max-w-none text-muted-foreground">
          <p>
            leersports uses cookies to keep you signed in, remember preferences, and understand how the
            platform is used. This is a placeholder document — replace it with your finalized policy
            before launch.
          </p>
          <h2 className="mt-8 text-xl font-semibold text-foreground">Essential cookies</h2>
          <p>Required for authentication and core functionality.</p>
          <h2 className="mt-8 text-xl font-semibold text-foreground">Analytics cookies</h2>
          <p>Help us measure performance and improve the product. Optional.</p>
          <h2 className="mt-8 text-xl font-semibold text-foreground">Managing cookies</h2>
          <p>You can clear or block cookies from your browser at any time.</p>
        </div>
      </div>
    </main>
  );
}