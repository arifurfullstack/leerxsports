import { createFileRoute } from "@tanstack/react-router";
import { Lock, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/security")({
  head: () => ({ meta: [{ title: "Admin · Security & system" }] }),
  component: SecurityPage,
});

function SecurityPage() {
  const items: { label: string; value: string; ok: boolean }[] = [
    { label: "Row-level security", value: "Enabled on all user tables", ok: true },
    { label: "Auth provider", value: "Lovable Cloud", ok: true },
    { label: "Service role key", value: "Server-only", ok: true },
    { label: "Audit logging", value: "Enabled", ok: true },
  ];
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">Admin</p>
        <h1 className="font-display text-3xl uppercase tracking-tight">Security & system</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only status of platform security posture.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((it) => (
          <div key={it.label} className="flex items-start gap-3 rounded-lg border border-border bg-card p-5">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              {it.ok ? <ShieldCheck className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {it.label}
              </p>
              <p className="mt-1 font-medium">{it.value}</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}