import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const getAdminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: a }, { data: m }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "moderator" }),
    ]);
    if (!a && !m) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    async function count(table: string, filter?: (q: any) => any) {
      let q: any = (supabaseAdmin as any).from(table).select("*", { count: "exact", head: true });
      if (filter) q = filter(q);
      const { count: c } = await q;
      return c ?? 0;
    }
    const [users, trainers, posts, subs, txns, refunds, disputes, strikes] = await Promise.all([
      count("profiles"),
      count("trainer_profiles"),
      count("posts"),
      count("subscriptions", (q) => q.in("status", ["active", "trial", "grace"])),
      count("transactions"),
      count("transactions", (q) => q.eq("status", "refunded")),
      count("coaching_disputes"),
      count("trainer_strikes"),
    ]);
    return { users, trainers, posts, subs, txns, refunds, disputes, strikes };
  });

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  head: () => ({ meta: [{ title: "Admin · Analytics" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const fn = useServerFn(getAdminAnalytics);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: () => fn(),
  });
  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const tiles: { label: string; value: number }[] = [
    { label: "Users", value: data.users },
    { label: "Trainers", value: data.trainers },
    { label: "Posts", value: data.posts },
    { label: "Active subscriptions", value: data.subs },
    { label: "Transactions", value: data.txns },
    { label: "Refunds", value: data.refunds },
    { label: "Coaching disputes", value: data.disputes },
    { label: "Trainer strikes", value: data.strikes },
  ];
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">Admin</p>
        <h1 className="font-display text-3xl uppercase tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Snapshot of key platform totals.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {t.label}
            </p>
            <p className="mt-2 font-display text-3xl tracking-tight">{t.value}</p>
          </div>
        ))}
      </div>
    </main>
  );
}