import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import * as React from "react";
import { format, subDays } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Users,
  UserCheck,
  ShieldAlert,
  Flag,
  CreditCard,
  Image as ImageIcon,
  MessageCircle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText,
  Ban,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Activity,
  Zap,
  Eye,
  UserPlus,
  Settings2,
  BarChart3,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  adminGetOverview,
  adminGetSignupSeries,
  adminGetRecentActivity,
  adminGetDashboardExtras,
} from "@/lib/admin-analytics-functions";
import { AdminDemoPanel } from "@/components/admin-demo-panel";
import { AnimatedNumber } from "@/components/admin/animated-number";
import { Sparkline } from "@/components/admin/sparkline";
import { UserAvatar } from "@/components/user-avatar";
import {
  DashboardSkeleton,
  ErrorBanner,
  EmptyState,
  CardErrorBoundary,
} from "@/components/admin/dashboard-states";

function toDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function presetToRange(preset: string = "30", start?: string, end?: string) {
  const today = toDay(new Date());
  if (preset === "custom" && start && end) {
    return { start, end, days: diffDays(start, end) };
  }
  const days = preset === "7" ? 7 : preset === "90" ? 90 : 30;
  return { start: toDay(subDays(new Date(), days - 1)), end: today, days };
}

function diffDays(a: string, b: string) {
  const ms =
    new Date(`${b}T00:00:00Z`).getTime() -
    new Date(`${a}T00:00:00Z`).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

const searchSchema = z.object({
  preset: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
});

const overviewQ = queryOptions({
  queryKey: ["admin-overview"],
  queryFn: () => adminGetOverview(),
});
const seriesQ = (start: string, end: string) =>
  queryOptions({
    queryKey: ["admin-signup-series", start, end],
    queryFn: () => adminGetSignupSeries({ data: { start, end } }),
  });
const activityQ = queryOptions({
  queryKey: ["admin-recent-activity"],
  queryFn: () => adminGetRecentActivity(),
});
const extrasQ = (start: string, end: string) =>
  queryOptions({
    queryKey: ["admin-dashboard-extras", start, end],
    queryFn: () => adminGetDashboardExtras({ data: { start, end } }),
  });

export const Route = createFileRoute("/_authenticated/admin/")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({
    preset: search.preset,
    start: search.start,
    end: search.end,
  }),
  loader: async ({ context, deps }) => {
    const { start, end } = presetToRange(deps.preset, deps.start, deps.end);
    await Promise.all([
      context.queryClient.ensureQueryData(overviewQ),
      context.queryClient.ensureQueryData(seriesQ(start, end)),
      context.queryClient.ensureQueryData(activityQ),
      context.queryClient.ensureQueryData(extrasQ(start, end)),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Admin — Dashboard — LEER Sports" },
      { name: "description", content: "Platform analytics and moderation overview." },
    ],
  }),
  component: AdminDashboardPage,
  errorComponent: AdminDashboardError,
  pendingComponent: DashboardSkeleton,
  pendingMs: 200,
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function AdminDashboardError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <main className="min-h-dvh bg-background py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6">
          <span className="font-display text-xs uppercase tracking-[0.3em] text-primary">
            Admin
          </span>
          <h1 className="mt-1 font-display text-3xl uppercase tracking-tight">
            Dashboard
          </h1>
        </header>
        <ErrorBanner
          title="Couldn't load dashboard metrics"
          message={
            error?.message ||
            "An unexpected error occurred while fetching admin analytics."
          }
          onRetry={() => {
            reset();
            router.invalidate();
          }}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/admin/users"
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold uppercase tracking-widest hover:border-primary/60"
          >
            Go to users
          </Link>
          <Link
            to="/admin/moderation"
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold uppercase tracking-widest hover:border-primary/60"
          >
            Go to moderation
          </Link>
        </div>
      </div>
    </main>
  );
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
];

function AdminDashboardPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { start, end, days: rangeDays } = presetToRange(
    search.preset,
    search.start,
    search.end,
  );
  // Trend comparison window = same length as current range
  const half = Math.max(1, Math.floor(rangeDays / 2));

  const { data: o } = useSuspenseQuery(overviewQ);
  const { data: series } = useSuspenseQuery(seriesQ(start, end));
  const { data: activity } = useSuspenseQuery(activityQ);
  const { data: extras } = useSuspenseQuery(extrasQ(start, end));

  // Trend calc: second half of range vs first half
  const sum = (arr: { count: number }[]) => arr.reduce((a, b) => a + b.count, 0);
  const trendPct = (recent: number, prior: number) =>
    prior === 0 ? (recent > 0 ? 100 : 0) : ((recent - prior) / prior) * 100;

  const signupsRecent = sum(series.slice(-half));
  const signupsPrior = sum(series.slice(-half * 2, -half));
  const signupTrend = trendPct(signupsRecent, signupsPrior);
  const signupsTotal = sum(series);

  const subsRecent = sum(extras.subSeries.slice(-half));
  const subsPrior = sum(extras.subSeries.slice(-half * 2, -half));
  const subsTrend = trendPct(subsRecent, subsPrior);
  const subsTotal = sum(extras.subSeries);

  const postsRecent = sum(extras.postSeries.slice(-half));
  const postsPrior = sum(extras.postSeries.slice(-half * 2, -half));
  const postsTrend = trendPct(postsRecent, postsPrior);
  const postsTotal = sum(extras.postSeries);

  const tipsRecent = extras.tipsSeries
    .slice(-half)
    .reduce((a, b) => a + b.amount, 0);
  const tipsPrior = extras.tipsSeries
    .slice(-half * 2, -half)
    .reduce((a, b) => a + b.amount, 0);
  const tipsTrend = trendPct(tipsRecent, tipsPrior);
  const tipsTotalRange = extras.tipsSeries.reduce((a, b) => a + b.amount, 0);

  // Combined series for main chart
  const combined = series.map((s, i) => ({
    date: s.date.slice(5),
    Signups: s.count,
    Subscriptions: extras.subSeries[i]?.count ?? 0,
    Posts: extras.postSeries[i]?.count ?? 0,
  }));

  const contentMix = [
    { name: "Posts", value: o.posts },
    { name: "Transformations", value: o.transformations },
    { name: "Community", value: o.communityPosts },
  ];

  const heroStats: HeroStat[] = [
    {
      label: "Signups in range",
      value: signupsTotal,
      sub: `${o.users.toLocaleString()} total users`,
      trend: signupTrend,
      icon: Users,
      spark: series.map((s) => s.count),
      accent: "primary",
    },
    {
      label: "New subscriptions",
      value: subsTotal,
      sub: `${o.activeSubs.toLocaleString()} active`,
      trend: subsTrend,
      icon: CreditCard,
      spark: extras.subSeries.map((s) => s.count),
      accent: "accent",
    },
    {
      label: "Tips revenue",
      value: `$${tipsTotalRange.toFixed(2)}`,
      sub: `$${o.tipsTotal.toFixed(2)} all-time`,
      trend: tipsTrend,
      icon: DollarSign,
      spark: extras.tipsSeries.map((s) => Math.round(s.amount)),
      accent: "warning",
    },
    {
      label: "Posts in range",
      value: postsTotal,
      sub: `${o.posts.toLocaleString()} all-time`,
      trend: postsTrend,
      icon: ImageIcon,
      spark: extras.postSeries.map((s) => s.count),
      accent: "primary",
    },
  ];

  const secondaryStats = [
    { label: "Trainers", value: o.trainers, icon: UserCheck, to: "/admin/trainers" as const },
    {
      label: "Pending applications",
      value: o.pendingApps,
      icon: FileText,
      to: "/admin/trainers" as const,
      tone: o.pendingApps > 0 ? ("warn" as const) : undefined,
    },
    {
      label: "Open reports",
      value: o.openReports,
      icon: Flag,
      to: "/admin/reports" as const,
      tone: o.openReports > 0 ? ("danger" as const) : undefined,
    },
    { label: "Active strikes", value: o.strikes, icon: Ban, to: "/admin/strikes" as const },
    {
      label: "Hidden posts",
      value: o.hiddenPosts,
      icon: Eye,
      to: "/admin/moderation" as const,
    },
    { label: "Transformations", value: o.transformations, icon: TrendingUp, to: "/admin/transformations" as const },
    { label: "Community", value: o.communityPosts, icon: MessageCircle, to: "/admin/community" as const },
    { label: "Admins", value: o.admins, icon: ShieldAlert, to: "/admin/roles" as const },
  ];

  const quickActions = [
    { label: "Manage users", to: "/admin/users" as const, icon: Users, desc: "Search, edit, verify" },
    { label: "Review applications", to: "/admin/trainers" as const, icon: UserPlus, desc: "Trainer approvals" },
    { label: "Reports queue", to: "/admin/reports" as const, icon: Flag, desc: "Handle abuse" },
    { label: "Payments", to: "/admin/payments" as const, icon: CreditCard, desc: "Payouts & tips" },
    { label: "Settings", to: "/admin/settings" as const, icon: Settings2, desc: "Platform config" },
    { label: "Full analytics", to: "/admin/analytics" as const, icon: BarChart3, desc: "Deep-dive" },
  ];

  return (
    <main className="min-h-dvh bg-background py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
              <ShieldCheck className="h-3 w-3" />
              Live overview
            </span>
            <h1 className="mt-3 font-display text-4xl uppercase tracking-tight sm:text-5xl">
              Command center
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Real-time pulse of the LEER platform — audience growth, monetization,
              content, and safety in one glance.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <RangePicker
              preset={search.preset || "30"}
              start={start}
              end={end}
              onChange={(next) =>
                navigate({
                  search: (prev: any) => ({
                    ...prev,
                    ...next,
                  }),
                  replace: true,
                })
              }
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              {format(new Date(`${start}T00:00:00`), "MMM d")} — {format(new Date(`${end}T00:00:00`), "MMM d")}
            </div>
          </div>
        </header>

        {/* Hero stats */}
        <section aria-label="Key metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {heroStats.map((s, i) => (
            <HeroStatCard key={s.label} stat={s} delay={i * 60} />
          ))}
        </section>

        {/* Main chart + donut */}
        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 className="font-display text-sm uppercase tracking-widest">
                  Activity — last {rangeDays} days
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Signups, subscriptions and posts per day
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <LegendDot color="hsl(var(--primary))" label="Signups" />
                <LegendDot color="hsl(var(--accent))" label="Subscriptions" />
                <LegendDot color="hsl(var(--warning))" label="Posts" />
              </div>
            </div>
            <div className="h-72 w-full">
              {combined.every((c) => !c.Signups && !c.Subscriptions && !c.Posts) ? (
                <EmptyState
                  icon={Activity}
                  title="No activity in this range"
                  desc="Try a wider window or wait for new signups, subscriptions, or posts."
                  height="h-full"
                />
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={combined} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gSignups" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gSubs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gPosts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--warning))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--warning))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval={3}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <RTooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Signups"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#gSignups)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Subscriptions"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    fill="url(#gSubs)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Posts"
                    stroke="hsl(var(--warning))"
                    strokeWidth={2}
                    fill="url(#gPosts)"
                  />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-display text-sm uppercase tracking-widest">
                Content mix
              </h2>
              <span className="text-xs text-muted-foreground">
                {(o.posts + o.transformations + o.communityPosts).toLocaleString()} items
              </span>
            </div>
            <div className="h-56 w-full">
              {contentMix.every((c) => c.value === 0) ? (
                <EmptyState
                  icon={ImageIcon}
                  title="No content yet"
                  desc="Posts, transformations, and community items will show here."
                  height="h-full"
                />
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={contentMix}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={3}
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  >
                    {contentMix.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              )}
            </div>
            <ul className="mt-2 space-y-1.5 text-xs">
              {contentMix.map((c, i) => (
                <li key={c.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    {c.name}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {c.value.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Secondary KPI strip */}
        <section
          aria-label="Secondary metrics"
          className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
        >
          {secondaryStats.map((s) => {
            const Icon = s.icon;
            const tone =
              s.tone === "danger"
                ? "text-destructive border-destructive/40"
                : s.tone === "warn"
                  ? "text-warning border-warning/40"
                  : "text-primary border-border";
            return (
              <Link
                key={s.label}
                to={s.to}
                className={`group flex items-center justify-between rounded-lg border ${tone} bg-card px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_8px_20px_-10px_hsl(var(--primary)/0.4)]`}
              >
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {s.label}
                  </p>
                  <AnimatedNumber
                    value={s.value}
                    className="mt-0.5 block font-display text-lg tabular-nums"
                  />
                </div>
                <Icon className="h-4 w-4 shrink-0 opacity-70 transition-transform group-hover:scale-110" />
              </Link>
            );
          })}
        </section>

        {/* Reports + Top trainers */}
        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
            <div className="mb-3 flex items-baseline justify-between">
              <div>
                <h2 className="font-display text-sm uppercase tracking-widest">
                  Reports by reason
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Open + reviewed queue breakdown
                </p>
              </div>
              <Link
                to="/admin/reports"
                className="text-xs text-primary hover:underline"
              >
                Open queue →
              </Link>
            </div>
            {extras.reportsByReason.length === 0 ? (
              <EmptyState
                icon={ShieldAlert}
                title="No open reports"
                desc="The moderation queue is clear — nice work."
              />
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={extras.reportsByReason}
                    margin={{ top: 10, right: 8, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis
                      dataKey="reason"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={30}
                      allowDecimals={false}
                    />
                    <RTooltip
                      cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="count"
                      radius={[6, 6, 0, 0]}
                      fill="hsl(var(--destructive))"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-sm uppercase tracking-widest">
                Top trainers
              </h2>
              <Link
                to="/admin/trainers"
                className="text-xs text-primary hover:underline"
              >
                All →
              </Link>
            </div>
            {extras.topTrainers.length === 0 ? (
              <EmptyState
                icon={UserCheck}
                title="No trainers yet"
                desc="Approve applications to see leaders here."
                action={
                  <Link
                    to="/admin/trainers"
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-widest hover:border-primary/60"
                  >
                    Review applications
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-2.5">
                {extras.topTrainers.map((t, i) => (
                  <li
                    key={t.user_id}
                    className="flex items-center gap-3 rounded-lg border border-transparent p-1.5 transition-colors hover:border-border hover:bg-muted/30"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted/50 text-[10px] font-bold tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <UserAvatar
                      src={t.avatar_url}
                      name={t.display_name ?? t.username ?? "T"}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {t.display_name ?? t.username ?? "Trainer"}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        @{t.username ?? "—"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-[11px]">
                      <p className="tabular-nums">
                        {t.subscribers.toLocaleString()}
                        <span className="ml-1 text-muted-foreground">subs</span>
                      </p>
                      <p className="tabular-nums text-muted-foreground">
                        {t.followers.toLocaleString()} followers
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Quick actions */}
        <section className="mt-6 rounded-xl border border-border bg-gradient-to-br from-card to-card/50 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm uppercase tracking-widest">
              Quick actions
            </h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {quickActions.map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.label}
                  to={a.to}
                  className="group flex flex-col gap-1 rounded-lg border border-border bg-background/50 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:bg-background"
                >
                  <Icon className="h-4 w-4 text-primary transition-transform group-hover:scale-110" />
                  <p className="mt-1 text-sm font-semibold">{a.label}</p>
                  <p className="text-[11px] text-muted-foreground">{a.desc}</p>
                </Link>
              );
            })}
          </div>
        </section>

        <div className="mt-6">
          <AdminDemoPanel />
        </div>

        {/* Recent activity */}
        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <ActivityCard
            title="Recent reports"
            emptyLabel="No reports yet"
            linkTo="/admin/moderation"
            linkLabel="Moderation"
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
            linkLabel="Applications"
            items={activity.apps.map((a) => ({
              key: a.id,
              primary: a.public_trainer_name ?? "—",
              secondary: a.status,
              time: a.created_at,
            }))}
          />
          <ActivityCard
            title="Recent subscriptions"
            emptyLabel="No subscriptions yet"
            linkTo="/admin/subscriptions"
            linkLabel="Subscriptions"
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

type HeroStat = {
  label: string;
  value: string | number;
  sub: string;
  trend: number;
  icon: React.ComponentType<{ className?: string }>;
  spark: number[];
  accent: "primary" | "accent" | "warning";
};

function HeroStatCard({ stat, delay }: { stat: HeroStat; delay: number }) {
  const Icon = stat.icon;
  const up = stat.trend >= 0;
  const accentBg =
    stat.accent === "warning"
      ? "from-warning/15 to-transparent"
      : stat.accent === "accent"
        ? "from-accent/15 to-transparent"
        : "from-primary/15 to-transparent";
  const accentText =
    stat.accent === "warning"
      ? "text-warning"
      : stat.accent === "accent"
        ? "text-accent"
        : "text-primary";
  const sparkStroke =
    stat.accent === "warning"
      ? "stroke-warning"
      : stat.accent === "accent"
        ? "stroke-accent"
        : "stroke-primary";
  const sparkFill =
    stat.accent === "warning"
      ? "fill-warning/15"
      : stat.accent === "accent"
        ? "fill-accent/15"
        : "fill-primary/15";

  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className={`group relative overflow-hidden rounded-xl border border-border bg-card p-5 opacity-0 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 fill-mode-forwards hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_20px_50px_-20px_hsl(var(--primary)/0.4)]`}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accentBg} opacity-60`}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {stat.label}
          </p>
          <span
            className={`grid h-8 w-8 place-items-center rounded-lg bg-background/60 backdrop-blur ${accentText} transition-transform group-hover:scale-110`}
          >
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <AnimatedNumber
          value={stat.value}
          className="mt-3 block font-display text-3xl tabular-nums"
        />
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${
              up
                ? "bg-primary/15 text-primary"
                : "bg-destructive/15 text-destructive"
            }`}
          >
            {up ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(stat.trend).toFixed(0)}%
          </span>
          <span>{stat.sub}</span>
        </div>
        <Sparkline
          points={stat.spark}
          strokeClassName={sparkStroke}
          fillClassName={sparkFill}
          className="mt-4 h-10 w-full opacity-80 transition-opacity group-hover:opacity-100"
        />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
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
  linkTo: "/admin/moderation" | "/admin/trainers" | "/admin/subscriptions";
  linkLabel: string;
}) {
  return (
    <div className="group rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_10px_30px_-12px_hsl(var(--primary)/0.35)]">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="flex items-center gap-2 font-display text-sm uppercase tracking-widest">
          <Activity className="h-3.5 w-3.5 text-primary" />
          {title}
        </h3>
        <Link
          to={linkTo}
          className="group/link inline-flex items-center gap-1 text-xs text-primary transition-colors hover:text-primary"
        >
          {linkLabel}
          <span className="inline-block transition-transform duration-200 group-hover/link:translate-x-1">
            →
          </span>
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={Activity}
          title={emptyLabel}
          desc="New entries will appear here as they arrive."
          height="h-40"
        />
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map((it, i) => (
            <li
              key={it.key}
              style={{ animationDelay: `${i * 60}ms` }}
              className="flex items-center justify-between py-2.5 text-sm opacity-0 animate-in fade-in slide-in-from-left-2 fill-mode-forwards"
            >
              <div className="min-w-0 flex-1 pr-3">
                <p className="truncate text-foreground">{it.primary}</p>
                {it.secondary && (
                  <span
                    className={`mt-0.5 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-widest ${
                      /open|pending/i.test(it.secondary)
                        ? "border-warning/40 bg-warning/10 text-warning"
                        : /approved|active|resolved/i.test(it.secondary)
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : /rejected|banned|hidden/i.test(it.secondary)
                            ? "border-destructive/40 bg-destructive/10 text-destructive"
                            : "border-border bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    {it.secondary}
                  </span>
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

type RangeChange = { preset: string; start: string; end: string };

function RangePicker({
  preset,
  start,
  end,
  onChange,
}: {
  preset: string;
  start: string;
  end: string;
  onChange: (next: RangeChange) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [range, setRange] = React.useState<import("react-day-picker").DateRange | undefined>({
    from: new Date(`${start}T00:00:00`),
    to: new Date(`${end}T00:00:00`),
  });

  const presets: { key: string; label: string }[] = [
    { key: "7", label: "7d" },
    { key: "30", label: "30d" },
    { key: "90", label: "90d" },
  ];

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1">
      {presets.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() =>
            onChange({ preset: p.key, start: "", end: "" })
          }
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-widest transition-colors",
            preset === p.key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
          aria-pressed={preset === p.key}
        >
          {p.label}
        </button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 gap-1.5 rounded-md px-2 text-xs font-semibold uppercase tracking-widest",
              preset === "custom"
                ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                : "text-muted-foreground",
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {preset === "custom"
              ? `${format(new Date(`${start}T00:00:00`), "MMM d")} – ${format(new Date(`${end}T00:00:00`), "MMM d")}`
              : "Custom"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={range}
            onSelect={(r) => {
              setRange(r);
              if (r?.from && r?.to) {
                onChange({
                  preset: "custom",
                  start: toDay(r.from),
                  end: toDay(r.to),
                });
                setOpen(false);
              }
            }}
            numberOfMonths={2}
            defaultMonth={range?.from}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
