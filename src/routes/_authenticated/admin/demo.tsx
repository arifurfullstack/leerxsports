import { createFileRoute } from "@tanstack/react-router";
import { AdminDemoPanel } from "@/components/admin-demo-panel";

export const Route = createFileRoute("/_authenticated/admin/demo")({
  head: () => ({ meta: [{ title: "Admin · Demo content" }] }),
  component: DemoPage,
});

function DemoPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">
          Admin
        </p>
        <h1 className="font-display text-3xl uppercase tracking-tight">
          Demo data
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seed or clear the platform&rsquo;s demo dataset. Each step shows live
          progress, per-step counts, and a success or failure summary.
        </p>
      </header>
      <AdminDemoPanel />
    </main>
  );
}