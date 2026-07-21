import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  Users,
  UserCheck,
  ShieldAlert,
  Flag,
  CreditCard,
  Calendar,
  Image as ImageIcon,
  MessageCircle,
  DollarSign,
  TrendingUp,
  FileText,
  Ban,
} from "lucide-react";
import {
  adminGetOverview,
  adminGetSignupSeries,
  adminGetRecentActivity,
} from "@/lib/admin-analytics-functions";
import { AdminNav } from "@/components/admin-nav";
import { AdminDemoPanel } from "@/components/admin-demo-panel";

const overviewQ = queryOptions({
  queryKey: ["admin-overview"],
  queryFn: () => adminGetOverview(),
});
const seriesQ = queryOptions({
  queryKey: ["admin-signup-series"],
  queryFn: () => adminGetSignupSeries(),
});
const activityQ = queryOptions({
  queryKey: ["admin-recent-activity"],
  queryFn: () => adminGetRecentActivity(),
});

export const Route = createFileRoute("/_authenticated/admin/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(overviewQ),
      context.queryClient.ensureQueryData(seriesQ),
      context.queryClient.ensureQueryData(activityQ),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Admin — Dashboard — LEER Sports" },
      { name: "description", content: "Platform analytics and moderation overview." },
    ],
  }),
  component: AdminDashboardPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function AdminDashboardPage() {
  const { data: o } = useSuspenseQuery(overviewQ);
  const { data: series } = useSuspenseQuery(seriesQ);
  const { data: activity } = useSuspenseQuery(activityQ);

  const stats: {
    label: string;
    value: string | number;
    hint?: string;
    icon: React.ComponentType<{ className?: string }>;
    tone?: "primary" | "warn" | "danger";
  }[] = [
    { label: "Total users", value: o.users, hint: `+${o.newUsers7} this week`, icon: Users },
    { label: "Trainers", value: o.trainers, hint: `${o.admins} admins`, icon: UserCheck },
    {
      label: "Pending applications",
      value: o.pendingApps,
      hint: `of ${o.trainerApps} total`,
      icon: FileText,
      tone: o.pendingApps > 0 ? "warn" : undefined,
    },
    {
      label: "Active subscriptions",
      value: o.activeSubs,
      hint: `+${o.subs7} this week`,
      icon: CreditCard,
    },
    { label: "Classes", value: o.classes, icon: Calendar },
    { label: "Bookings", value: o.bookings, hint: `+${o.bookings7} this week`, icon: Calendar },
    { label: "Posts", value: o.posts, hint: `${o.hiddenPosts} hidden`, icon: ImageIcon },
    { label: "Transformations", value: o.transformations, icon: TrendingUp },
    { label: "Community threads", value: o.communityPosts, icon: MessageCircle },
    { label: "Coaching requests", value: o.coachingReqs, icon: MessageCircle },
    {
      label: "Open reports",
      value: o.openReports,
      icon: Flag,
      tone: o.openReports > 0 ? "danger" : undefined,
    },
    {
      label: "Open disputes",
      value: o.openDisputes,
      icon: ShieldAlert,
      tone: o.openDisputes > 0 ? "danger" : undefined,
    },
    { label: "Active strikes", value: o.strikes, icon: Ban },
    {
      label: "Tips (30d)",
      value: `$${o.tips30Total.toFixed(2)}`,
      hint: `$${o.tipsTotal.toFixed(2)} all-time`,
      icon: DollarSign,
    },
  ];

  const maxSignup = Math.max(1, ...series.map((s) => s.count));

  return (
    <main className="min-h-dvh bg-background py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6">
          <span className="font-display text-xs uppercase tracking-[0.3em] text-primary">
            Admin
          </span>
          <h1 className="mt-1 font-display text-3xl uppercase tracking-tight">
            Dashboard
          </h1>
          <AdminNav />
        </header>

        <section
          aria-label="Key metrics"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {stats.map((s) => {
            const Icon = s.icon;
            const toneClass =
              s.tone === "danger"
                ? "text-destructive"
                : s.tone === "warn"
                  ? "text-warning"
                  : "text-primary";
            return (
              <div
                key={s.label}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {s.label}
                  </p>
                  <Icon className={`h-4 w-4 ${toneClass}`} />
                </div>
                <p className="mt-2 font-display text-2xl">{s.value}</p>
                {s.hint && (
                  <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
                )}
              </div>
            );
          })}
        </section>

        <section className="mt-8 rounded-lg border border-border bg-card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-sm uppercase tracking-widest">
              Signups — last 30 days
            </h2>
            <p className="text-xs text-muted-foreground">
              {series.reduce((a, b) => a + b.count, 0)} total
            </p>
          </div>
          <div className="mt-4 flex h-32 items-end gap-1">
            {series.map((s) => (
              <div
                key={s.date}
                className="group relative flex-1"
                title={`${s.date}: ${s.count}`}
              >
                <div
                  className="w-full rounded-t bg-primary/70 transition-colors hover:bg-primary"
                  style={{ height: `${(s.count / maxSignup) * 100}%`, minHeight: 2 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>{series[0]?.date}</span>
            <span>{series[series.length - 1]?.date}</span>
          </div>
        </section>

        <AdminDemoPanel />

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <ActivityCard
            title="Recent reports"
            emptyLabel="No reports yet"
            linkTo="/admin/moderation"
            linkLabel="Open moderation"
            items={activity.reports.map((r) => ({
              key: r.id,
              primary: `${r.target_type} · ${r.reason}`,
              secondary: r.status,
              time: r.created_at,
            }))}
          />
          <ActivityCard
            title="Recent applications"
            emptyLabel="No applications yet"
            linkTo="/admin/trainers"
            linkLabel="Review applications"
            items={activity.apps.map((a) => ({
              key: a.id,
              primary: a.public_trainer_name ?? "—",
              secondary: a.status,
              time: a.created_at,
            }))}
          />
          <ActivityCard
            title="Recent bookings"
            emptyLabel="No bookings yet"
            linkTo="/admin/bookings"
            linkLabel="View bookings"
            items={activity.bookings.map((b) => ({
              key: b.id,
              primary: `Class ${String(b.class_id).slice(0, 8)}…`,
              secondary: b.status,
              time: b.booked_at,
            }))}
          />
          <ActivityCard
            title="Recent subscriptions"
            emptyLabel="No subscriptions yet"
            linkTo="/admin/trainers"
            linkLabel="Trainers"
            items={activity.subs.map((s) => ({
              key: s.id,
              primary: `Subscription ${String(s.id).slice(0, 8)}…`,
              secondary: s.status,
              time: s.created_at,
            }))}
          />
        </section>
      </div>
    </main>
  );
}

function ActivityCard({
  title,
  emptyLabel,
  items,
  linkTo,
  linkLabel,
}: {
  title: string;
  emptyLabel: string;
  items: { key: string; primary: string; secondary?: string | null; time?: string | null }[];
  linkTo: "/admin/moderation" | "/admin/trainers" | "/admin/bookings" | "/admin/classes";
  linkLabel: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-sm uppercase tracking-widest">{title}</h3>
        <Link to={linkTo} className="text-xs text-primary hover:underline">
          {linkLabel} →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {items.map((it) => (
            <li key={it.key} className="flex items-center justify-between py-2 text-sm">
              <div className="min-w-0 flex-1 pr-3">
                <p className="truncate text-foreground">{it.primary}</p>
                {it.secondary && (
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {it.secondary}
                  </p>
                )}
              </div>
              {it.time && (
                <time className="shrink-0 text-[11px] text-muted-foreground">
                  {new Date(it.time).toLocaleDateString()}
                </time>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}