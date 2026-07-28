import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getOnboardingState } from "@/lib/onboarding-functions";
import { getOnboardingProgress } from "@/lib/onboarding-functions";
import { listMyPosts, deletePost } from "@/lib/post-functions";
import { PostComposer } from "@/components/post-composer";
import { TransformationComposer } from "@/components/transformation-composer";
import {
  listMyTransformations,
  deleteTransformation,
  updateTraineeProfile,
} from "@/lib/transformation-functions";
import {
  getTrainerBalance,
  listTrainerTransactions,
  listMyPayouts,
  requestPayout,
} from "@/lib/payments-functions";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Lock,
  Trash2,
  Play,
  BadgeCheck,
  Wallet,
  Loader2,
  User,
  Image as ImageIcon,
  TrendingUp,
  Users,
  ArrowUpRight,
  Settings,
  Compass,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useProfileMode } from "@/lib/profile-mode-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarUploader } from "@/components/avatar-uploader";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Check, Circle, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { DashboardWidgets, type WidgetDef } from "@/components/dashboard-widgets";
import { useMemo } from "react";

const onboardingStateQuery = queryOptions({
  queryKey: ["onboarding-state"],
  queryFn: () => getOnboardingState(),
});

const myPostsQuery = queryOptions({
  queryKey: ["my-posts"],
  queryFn: () => listMyPosts(),
});

const myTransformationsQuery = queryOptions({
  queryKey: ["my-transformations"],
  queryFn: () => listMyTransformations(),
});

const onboardingProgressQuery = queryOptions({
  queryKey: ["onboarding-progress"],
  queryFn: () => getOnboardingProgress(),
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(onboardingStateQuery);
    } catch (e) {
      console.error("Dashboard loader error:", e);
    }
  },
  head: () => ({
    meta: [
      { title: "Dashboard — LEER Sports" },
      { name: "description", content: "Your LEER Sports dashboard." },
      { property: "og:title", content: "Dashboard — LEER Sports" },
      { property: "og:description", content: "Your LEER Sports dashboard." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: DashboardPage,
  errorComponent: DashboardError,
  notFoundComponent: DashboardNotFound,
});

function DashboardPage() {
  const { data: state } = useSuspenseQuery(onboardingStateQuery);
  const { mode, switchMode } = useProfileMode();

  const profileIncomplete = !state.profile?.username || !state.profile?.display_name;
  const greeting = getGreeting();
  const roleLabel = state.isTrainer ? "Trainer" : state.isAdmin ? "Admin" : "Trainee";

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background py-6 sm:py-12">
      {/* Layered ambient background: grid + red pulse + noise */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 opacity-[0.07] [background-image:linear-gradient(to_right,hsl(var(--foreground)/0.35)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground)/0.35)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,#000_35%,transparent_75%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(ellipse_at_top,theme(colors.primary/0.22),transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-[-8%] -z-10 h-[520px] w-[520px] rounded-full bg-primary/20 blur-[140px] animate-pulse [animation-duration:6s]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[40%] left-[-10%] -z-10 h-[420px] w-[420px] rounded-full bg-primary/[0.06] blur-[120px]"
      />

      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        {profileIncomplete && (
          <div className="group mb-6 flex flex-col gap-3 overflow-hidden rounded-2xl border border-primary/50 bg-gradient-to-r from-primary/[0.14] via-primary/[0.06] to-transparent p-[1px] shadow-[0_0_40px_-8px_hsl(var(--primary)/0.35)] sm:flex-row">
            <div className="flex w-full flex-col gap-3 rounded-[15px] bg-background/70 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="relative shrink-0 rounded-xl bg-primary p-2 text-primary-foreground shadow-[0_0_20px_-2px_hsl(var(--primary))]">
                  <Rocket className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-[10px] uppercase tracking-[0.4em] text-primary">
                    ▲ Onboarding incomplete
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Finish setting up your profile so people can find and follow you.
                  </p>
                </div>
              </div>
              <Link to="/onboarding" search={{ resume: true, source: "dashboard_banner" }}>
                <Button size="sm" className="gap-1.5 font-display uppercase tracking-widest">
                  Resume <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Hero — editorial monochrome + neon */}
        <section className="relative mb-10 overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card/80 via-card/40 to-background/30 backdrop-blur-xl sm:mb-12">
          {/* Diagonal red slash */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary via-primary/40 to-transparent"
          />
          {/* Watermark */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-6 bottom-[-2.5rem] hidden select-none font-display text-[9rem] uppercase leading-none tracking-tighter text-foreground/[0.04] sm:block"
          >
            LEER
          </div>

          <div className="relative flex flex-col gap-5 p-4 sm:gap-8 sm:p-10">
            {/* Top row: eyebrow + actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 font-display text-[10px] uppercase tracking-[0.3em] text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                  {roleLabel}
                </span>
                {state.isTrainer && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                    <ShieldCheck className="h-3 w-3 text-primary" /> Verified pro
                  </span>
                )}
                <span className="hidden font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/70 sm:inline">
                  {greeting}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {/* Profile Mode Switcher Toolbar Button */}
                <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
                  <button
                    type="button"
                    onClick={() => switchMode("normal")}
                    className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-all ${
                      mode === "normal"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <User className="h-3.5 w-3.5" /> Athlete
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("creator")}
                    className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-all ${
                      mode === "creator"
                        ? "bg-amber-500 text-black font-bold shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Creator
                  </button>
                </div>

                {state.profile?.username && (
                  <Link
                    to={state.isTrainer ? "/trainers/$username" : "/u/$username"}
                    params={{ username: state.profile.username }}
                  >
                    <Button variant="outline" size="sm" className="gap-1.5 border-border/70 font-display uppercase tracking-widest hover:border-primary/60 hover:text-primary">
                      View profile <ArrowUpRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                )}
                <Link to="/settings">
                  <Button variant="ghost" size="sm" className="gap-1.5 font-display uppercase tracking-widest">
                    <Settings className="h-3.5 w-3.5" /> Settings
                  </Button>
                </Link>
              </div>
            </div>

            {/* Main row: avatar + display */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:gap-8">
              <div className="flex min-w-0 items-center gap-3 sm:gap-6">
                <AvatarUploader
                  hasAvatar={!!state.profile?.avatar_url}
                  className="shrink-0"
                >
                  <div aria-hidden className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary via-primary/40 to-transparent blur-md opacity-80" />
                  <div aria-hidden className="absolute -inset-0.5 rounded-full border border-primary/40" />
                  <Avatar className="relative h-16 w-16 border-2 border-background ring-1 ring-primary/50 sm:h-28 sm:w-28">
                    <AvatarImage src={state.profile?.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 font-display text-2xl uppercase text-primary">
                      {(state.profile?.display_name ?? "U").slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </AvatarUploader>
                <div className="min-w-0">
                  <h1 className="truncate font-display text-2xl uppercase leading-[0.95] tracking-tight sm:text-5xl md:text-6xl">
                    {state.profile?.display_name ?? "Command Center"}
                    <span className="text-primary">.</span>
                  </h1>
                  <p className="mt-1.5 max-w-lg text-xs text-muted-foreground sm:mt-2 sm:text-base">
                    {state.isTrainer
                      ? "Publish. Monetize. Dominate. Your community is watching."
                      : "Train with elite pros. Unlock premium drops. Move different."}
                  </p>
                </div>
              </div>

              {/* Right badge stack — hidden on mobile */}
              <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/70">
                  {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </span>
                <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-right">
                  <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary/80">Session</p>
                  <p className="font-display text-lg uppercase tracking-tight">Live</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {state.isTrainer ? (
          <TrainerDashboard userId={state.userId} username={state.profile?.username ?? null} />
        ) : (
          <TraineeDashboard
            userId={state.userId}
            username={state.profile?.username ?? null}
            applicationStatus={state.trainerApplication?.status ?? null}
          />
        )}
      </div>
    </main>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night grind";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Good night";
}

function StatTile({
  label,
  value,
  icon: Icon,
  hint,
  accent,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  accent?: boolean;
  tone?: ToneName;
}) {
  const t = TONES[tone];
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-3.5 transition-all duration-300 hover:-translate-y-0.5 sm:p-5 ${
        accent
          ? `${t.border} bg-gradient-to-br ${t.gradFrom} ${t.gradVia} to-transparent ${t.shadow}`
          : `border-border/60 bg-card/50 backdrop-blur ${t.hoverBorder} ${t.hoverShadow}`
      }`}
    >
      {/* Corner accent */}
      <div
        aria-hidden
        className={`pointer-events-none absolute right-0 top-0 h-8 w-8 border-r border-t transition-colors ${
          accent ? t.cornerBorder : `border-border/60 ${t.hoverCornerBorder}`
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute -bottom-8 -right-8 h-24 w-24 rounded-full blur-2xl transition-opacity ${
          accent ? `${t.glow} opacity-100` : `${t.glowSoft} opacity-0 group-hover:opacity-100`
        }`}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground sm:text-[10px] sm:tracking-[0.3em]">
          {label}
        </p>
        <div
          className={`shrink-0 rounded-lg border p-1.5 transition-colors ${
            accent
              ? `${t.iconBorder} ${t.iconBg} ${t.text}`
              : `border-border/50 bg-muted/40 text-muted-foreground ${t.hoverIconBorder} ${t.hoverText}`
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p
        className={`mt-3 truncate font-display text-2xl uppercase leading-none tracking-tight sm:mt-4 sm:text-4xl ${
          accent ? t.text : "text-foreground"
        }`}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1.5 truncate text-[10px] uppercase tracking-wider text-muted-foreground/80 sm:mt-2 sm:text-[11px]">{hint}</p>
      )}
    </div>
  );
}

type ToneName = "primary" | "teal" | "amber" | "violet" | "emerald" | "sky" | "rose";

const TONES: Record<ToneName, {
  text: string;
  hoverText: string;
  border: string;
  hoverBorder: string;
  cornerBorder: string;
  hoverCornerBorder: string;
  iconBorder: string;
  hoverIconBorder: string;
  iconBg: string;
  gradFrom: string;
  gradVia: string;
  shadow: string;
  hoverShadow: string;
  glow: string;
  glowSoft: string;
  qaHoverBorder: string;
  qaHoverShadow: string;
  qaBar: string;
  qaVia: string;
  qaIconBorder: string;
  qaIconBorderHover: string;
  qaIconBgHover: string;
}> = {
  primary: {
    text: "text-primary", hoverText: "group-hover:text-primary",
    border: "border-primary/50", hoverBorder: "hover:border-primary/40",
    cornerBorder: "border-primary/60", hoverCornerBorder: "group-hover:border-primary/60",
    iconBorder: "border-primary/50", hoverIconBorder: "group-hover:border-primary/40",
    iconBg: "bg-primary/20",
    gradFrom: "from-primary/15", gradVia: "via-primary/5",
    shadow: "shadow-[0_0_40px_-12px_hsl(var(--primary)/0.6)]",
    hoverShadow: "hover:shadow-[0_0_30px_-12px_hsl(var(--primary)/0.4)]",
    glow: "bg-primary/30", glowSoft: "bg-primary/10",
    qaHoverBorder: "hover:border-primary/50",
    qaHoverShadow: "hover:shadow-[0_0_36px_-14px_hsl(var(--primary)/0.6)]",
    qaBar: "from-primary", qaVia: "via-primary/10",
    qaIconBorder: "border-primary/30",
    qaIconBorderHover: "group-hover:border-primary/60",
    qaIconBgHover: "group-hover:bg-primary/20",
  },
  teal: {
    text: "text-teal-400", hoverText: "group-hover:text-teal-400",
    border: "border-teal-400/50", hoverBorder: "hover:border-teal-400/40",
    cornerBorder: "border-teal-400/60", hoverCornerBorder: "group-hover:border-teal-400/60",
    iconBorder: "border-teal-400/50", hoverIconBorder: "group-hover:border-teal-400/40",
    iconBg: "bg-teal-400/20",
    gradFrom: "from-teal-400/20", gradVia: "via-teal-400/5",
    shadow: "shadow-[0_0_40px_-12px_rgb(45_212_191/0.55)]",
    hoverShadow: "hover:shadow-[0_0_30px_-12px_rgb(45_212_191/0.4)]",
    glow: "bg-teal-400/30", glowSoft: "bg-teal-400/10",
    qaHoverBorder: "hover:border-teal-400/50",
    qaHoverShadow: "hover:shadow-[0_0_36px_-14px_rgb(45_212_191/0.55)]",
    qaBar: "from-teal-400", qaVia: "via-teal-400/10",
    qaIconBorder: "border-teal-400/30",
    qaIconBorderHover: "group-hover:border-teal-400/60",
    qaIconBgHover: "group-hover:bg-teal-400/20",
  },
  amber: {
    text: "text-amber-400", hoverText: "group-hover:text-amber-400",
    border: "border-amber-400/50", hoverBorder: "hover:border-amber-400/40",
    cornerBorder: "border-amber-400/60", hoverCornerBorder: "group-hover:border-amber-400/60",
    iconBorder: "border-amber-400/50", hoverIconBorder: "group-hover:border-amber-400/40",
    iconBg: "bg-amber-400/20",
    gradFrom: "from-amber-400/20", gradVia: "via-amber-400/5",
    shadow: "shadow-[0_0_40px_-12px_rgb(251_191_36/0.55)]",
    hoverShadow: "hover:shadow-[0_0_30px_-12px_rgb(251_191_36/0.4)]",
    glow: "bg-amber-400/30", glowSoft: "bg-amber-400/10",
    qaHoverBorder: "hover:border-amber-400/50",
    qaHoverShadow: "hover:shadow-[0_0_36px_-14px_rgb(251_191_36/0.55)]",
    qaBar: "from-amber-400", qaVia: "via-amber-400/10",
    qaIconBorder: "border-amber-400/30",
    qaIconBorderHover: "group-hover:border-amber-400/60",
    qaIconBgHover: "group-hover:bg-amber-400/20",
  },
  violet: {
    text: "text-violet-400", hoverText: "group-hover:text-violet-400",
    border: "border-violet-400/50", hoverBorder: "hover:border-violet-400/40",
    cornerBorder: "border-violet-400/60", hoverCornerBorder: "group-hover:border-violet-400/60",
    iconBorder: "border-violet-400/50", hoverIconBorder: "group-hover:border-violet-400/40",
    iconBg: "bg-violet-400/20",
    gradFrom: "from-violet-400/20", gradVia: "via-violet-400/5",
    shadow: "shadow-[0_0_40px_-12px_rgb(167_139_250/0.55)]",
    hoverShadow: "hover:shadow-[0_0_30px_-12px_rgb(167_139_250/0.4)]",
    glow: "bg-violet-400/30", glowSoft: "bg-violet-400/10",
    qaHoverBorder: "hover:border-violet-400/50",
    qaHoverShadow: "hover:shadow-[0_0_36px_-14px_rgb(167_139_250/0.55)]",
    qaBar: "from-violet-400", qaVia: "via-violet-400/10",
    qaIconBorder: "border-violet-400/30",
    qaIconBorderHover: "group-hover:border-violet-400/60",
    qaIconBgHover: "group-hover:bg-violet-400/20",
  },
  emerald: {
    text: "text-emerald-400", hoverText: "group-hover:text-emerald-400",
    border: "border-emerald-400/50", hoverBorder: "hover:border-emerald-400/40",
    cornerBorder: "border-emerald-400/60", hoverCornerBorder: "group-hover:border-emerald-400/60",
    iconBorder: "border-emerald-400/50", hoverIconBorder: "group-hover:border-emerald-400/40",
    iconBg: "bg-emerald-400/20",
    gradFrom: "from-emerald-400/20", gradVia: "via-emerald-400/5",
    shadow: "shadow-[0_0_40px_-12px_rgb(52_211_153/0.55)]",
    hoverShadow: "hover:shadow-[0_0_30px_-12px_rgb(52_211_153/0.4)]",
    glow: "bg-emerald-400/30", glowSoft: "bg-emerald-400/10",
    qaHoverBorder: "hover:border-emerald-400/50",
    qaHoverShadow: "hover:shadow-[0_0_36px_-14px_rgb(52_211_153/0.55)]",
    qaBar: "from-emerald-400", qaVia: "via-emerald-400/10",
    qaIconBorder: "border-emerald-400/30",
    qaIconBorderHover: "group-hover:border-emerald-400/60",
    qaIconBgHover: "group-hover:bg-emerald-400/20",
  },
  sky: {
    text: "text-sky-400", hoverText: "group-hover:text-sky-400",
    border: "border-sky-400/50", hoverBorder: "hover:border-sky-400/40",
    cornerBorder: "border-sky-400/60", hoverCornerBorder: "group-hover:border-sky-400/60",
    iconBorder: "border-sky-400/50", hoverIconBorder: "group-hover:border-sky-400/40",
    iconBg: "bg-sky-400/20",
    gradFrom: "from-sky-400/20", gradVia: "via-sky-400/5",
    shadow: "shadow-[0_0_40px_-12px_rgb(56_189_248/0.55)]",
    hoverShadow: "hover:shadow-[0_0_30px_-12px_rgb(56_189_248/0.4)]",
    glow: "bg-sky-400/30", glowSoft: "bg-sky-400/10",
    qaHoverBorder: "hover:border-sky-400/50",
    qaHoverShadow: "hover:shadow-[0_0_36px_-14px_rgb(56_189_248/0.55)]",
    qaBar: "from-sky-400", qaVia: "via-sky-400/10",
    qaIconBorder: "border-sky-400/30",
    qaIconBorderHover: "group-hover:border-sky-400/60",
    qaIconBgHover: "group-hover:bg-sky-400/20",
  },
  rose: {
    text: "text-rose-400", hoverText: "group-hover:text-rose-400",
    border: "border-rose-400/50", hoverBorder: "hover:border-rose-400/40",
    cornerBorder: "border-rose-400/60", hoverCornerBorder: "group-hover:border-rose-400/60",
    iconBorder: "border-rose-400/50", hoverIconBorder: "group-hover:border-rose-400/40",
    iconBg: "bg-rose-400/20",
    gradFrom: "from-rose-400/20", gradVia: "via-rose-400/5",
    shadow: "shadow-[0_0_40px_-12px_rgb(251_113_133/0.55)]",
    hoverShadow: "hover:shadow-[0_0_30px_-12px_rgb(251_113_133/0.4)]",
    glow: "bg-rose-400/30", glowSoft: "bg-rose-400/10",
    qaHoverBorder: "hover:border-rose-400/50",
    qaHoverShadow: "hover:shadow-[0_0_36px_-14px_rgb(251_113_133/0.55)]",
    qaBar: "from-rose-400", qaVia: "via-rose-400/10",
    qaIconBorder: "border-rose-400/30",
    qaIconBorderHover: "group-hover:border-rose-400/60",
    qaIconBgHover: "group-hover:bg-rose-400/20",
  },
};

function TraineeDashboard({
  userId,
  username,
  applicationStatus,
}: {
  userId: string;
  username: string | null;
  applicationStatus: string | null;
}) {
  const { data: transformations } = useQuery(myTransformationsQuery);
  const widgets = useMemo<WidgetDef[]>(
    () => [
      {
        id: "stats",
        label: "Stats",
        render: () => (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
            <StatTile
              label="Transformations"
              value={transformations?.length ?? 0}
              icon={TrendingUp}
              hint="Progress logged"
              accent
              tone="emerald"
            />
            <StatTile
              label="Public handle"
              value={username ? `@${username}` : "—"}
              icon={User}
              hint={username ? "Share your profile" : "Finish onboarding"}
              tone="sky"
            />
            <div className="col-span-2 sm:col-span-1">
            <StatTile
              label="Status"
              value={applicationStatus ?? "Trainee"}
              icon={BadgeCheck}
              hint={applicationStatus ? "Application in review" : "Explore & follow"}
              tone="amber"
            />
            </div>
          </div>
        ),
      },
      {
        id: "quick-actions",
        label: "Quick actions",
        render: () => (
          <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
            <QuickAction to="/trainers" label="Explore Trainers" icon={Compass} description="Find verified pros" tone="violet" />
            <QuickAction to="/feed" label="Open Feed" icon={ImageIcon} description="Latest posts" tone="sky" />
            <QuickAction to="/library" label="Your Library" icon={Users} description="Saved & subscriptions" tone="emerald" />
          </div>
        ),
      },
      ...(applicationStatus
        ? [
            {
              id: "application-status",
              label: "Application status",
              render: () => (
                <div className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur">
                  <p className="font-display uppercase tracking-widest text-sm">
                    Trainer Application:{" "}
                    <span className="text-primary">{applicationStatus}</span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {applicationStatus === "pending" &&
                      "Our team is reviewing your application. This typically takes 24–48 hours."}
                    {applicationStatus === "approved" &&
                      "Your application was approved. Refresh this page to enter the Trainer dashboard."}
                    {applicationStatus === "rejected" &&
                      "Your application was declined. You may re-apply after 30 days."}
                    {applicationStatus === "resubmit" &&
                      "Please update and resubmit your application from the onboarding flow."}
                  </p>
                </div>
              ),
            } satisfies WidgetDef,
          ]
        : []),
      { id: "profile-privacy", label: "Profile & privacy", render: () => <ProfileSettingsCard /> },
      { id: "onboarding-progress", label: "Onboarding progress", render: () => <OnboardingProgressCard /> },
      {
        id: "transformation-composer",
        label: "Log transformation",
        render: () => <TransformationComposer userId={userId} />,
      },
      { id: "transformations-grid", label: "Your transformations", render: () => <MyTransformationsGrid /> },
    ],
    [applicationStatus, transformations, userId, username],
  );
  return <DashboardWidgets scope="trainee" widgets={widgets} />;
}

function QuickAction({
  to,
  label,
  description,
  icon: Icon,
  tone = "primary",
}: {
  to: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: ToneName;
}) {
  const t = TONES[tone];
  return (
    <Link
      to={to}
      className={`group relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-3.5 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:bg-card ${t.qaHoverBorder} ${t.qaHoverShadow} sm:p-5`}
    >
      {/* Sliding gradient sweep on hover */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent ${t.qaVia} to-transparent transition-transform duration-700 group-hover:translate-x-full`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute left-0 top-0 h-full w-[3px] scale-y-0 bg-gradient-to-b ${t.qaBar} to-transparent transition-transform duration-300 group-hover:scale-y-100`}
      />
      <div className="relative flex min-w-0 items-center gap-3">
        <div className={`shrink-0 rounded-xl border ${t.qaIconBorder} ${t.glowSoft} p-2 ${t.text} transition-all duration-300 ${t.qaIconBorderHover} ${t.qaIconBgHover} sm:p-2.5`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className={`truncate font-display text-[13px] uppercase tracking-widest transition-colors ${t.hoverText} sm:text-sm`}>{label}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <ArrowUpRight className={`relative h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 ${t.hoverText}`} />
    </Link>
  );
}

function ProfileSettingsCard() {
  const { data: state } = useSuspenseQuery(onboardingStateQuery);
  const [bio, setBio] = useState<string>(state.profile?.display_name ? "" : "");
  const [goal, setGoal] = useState("");
  const [prs, setPrs] = useState("");
  const [profileVis, setProfileVis] = useState<"public" | "subscribers" | "private">("public");
  const [txVis, setTxVis] = useState<"public" | "subscribers" | "private">("public");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const update = useServerFn(updateTraineeProfile);

  const save = useMutation({
    mutationFn: () =>
      update({
        data: {
          bio: bio.trim() || null,
          goal: goal.trim() || null,
          personal_records: prs.trim() || null,
          profile_visibility: profileVis,
          transformation_visibility: txVis,
        },
      }),
    onSuccess: () => {
      setSaved(true);
      setError(null);
      qc.invalidateQueries({ queryKey: ["onboarding-state"] });
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <h2 className="font-display text-lg uppercase tracking-widest">Profile & Privacy</h2>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="mt-1"
            placeholder="Tell the community about yourself"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="goal">Current goal</Label>
          <Input
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="mt-1"
            placeholder="e.g. Cut to 12% body fat by June"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="prs">Personal records</Label>
          <Textarea
            id="prs"
            rows={3}
            value={prs}
            onChange={(e) => setPrs(e.target.value)}
            className="mt-1"
            placeholder={"Bench 100kg\nSquat 140kg\nDeadlift 180kg"}
          />
        </div>
        <div>
          <Label>Profile visibility</Label>
          <select
            value={profileVis}
            onChange={(e) => setProfileVis(e.target.value as typeof profileVis)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="public">Public</option>
            <option value="subscribers">Subscribers only</option>
            <option value="private">Private</option>
          </select>
        </div>
        <div>
          <Label>Transformation visibility</Label>
          <select
            value={txVis}
            onChange={(e) => setTxVis(e.target.value as typeof txVis)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="public">Public</option>
            <option value="subscribers">Subscribers only</option>
            <option value="private">Private</option>
          </select>
        </div>
      </div>
      {error && (
        <p className="mt-3 rounded border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="mt-4 flex items-center justify-end gap-3">
        {saved && <span className="text-xs text-primary">Saved</span>}
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function MyTransformationsGrid() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery(myTransformationsQuery);
  const qc = useQueryClient();
  const del = useServerFn(deleteTransformation);
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-transformations"] }),
  });

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg uppercase tracking-widest">
          Your Transformation
        </h2>
        <span className="text-xs text-muted-foreground">
          {isLoading ? "…" : `${data?.length ?? 0} logged`}
        </span>
      </div>
      {isLoading ? (
        <SquareGridSkeleton count={6} />
      ) : isError ? (
        <ErrorState
          title="Couldn't load your transformations"
          message={error instanceof Error ? error.message : "Something went wrong."}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      ) : data && data.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          {data.map((t) => (
            <div
              key={t.id}
              className="group relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-muted transition-transform hover:-translate-y-0.5 hover:border-primary/40"
            >
              {t.kind === "video" ? (
                <video src={t.media_url} muted loop className="h-full w-full object-cover" />
              ) : (
                <img
                  src={t.thumbnail_url ?? t.media_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 py-1.5 text-[10px] text-white">
                <span>{new Date(t.captured_on).toLocaleDateString()}</span>
                <span className="uppercase tracking-widest opacity-70">
                  {t.visibility === "public"
                    ? "PUB"
                    : t.visibility === "subscribers"
                      ? "SUB"
                      : "PRV"}
                </span>
              </div>
              <button
                onClick={() => remove.mutate(t.id)}
                disabled={remove.isPending}
                className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1.5 text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                aria-label="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={TrendingUp}
          title="No transformation entries yet"
          message="Log your first progress photo or video above to start your journey."
        />
      )}
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  message: string;
}) {
  return (
    <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/70 bg-card/40 p-10 text-center">
      <div className="rounded-full bg-primary/10 p-3 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-display text-sm uppercase tracking-widest">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function ErrorState({
  title,
  message,
  onRetry,
  retrying,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div
      role="alert"
      className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-8 text-center"
    >
      <p className="font-display text-sm uppercase tracking-widest text-destructive">
        {title}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
          {retrying && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          Try again
        </Button>
      )}
    </div>
  );
}

function SquareGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-xl" />
      ))}
    </div>
  );
}

function PostsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading posts">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-border/60 bg-card/60">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div
      className={`grid gap-3 ${cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"}`}
      aria-busy="true"
      aria-label="Loading stats"
    >
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
  );
}

function ListRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mt-2 space-y-2" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-md" />
      ))}
    </div>
  );
}

function TrainerDashboard({
  userId,
  username,
}: {
  userId: string;
  username: string | null;
}) {
  const {
    data: posts,
    isLoading,
    isError: postsError,
    error: postsErrObj,
    refetch: refetchPosts,
    isFetching: postsFetching,
  } = useQuery(myPostsQuery);
  const qc = useQueryClient();
  const deletePostFn = useServerFn(deletePost);
  const del = useMutation({
    mutationFn: (id: string) => deletePostFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-posts"] });
      qc.invalidateQueries({ queryKey: ["trainer"] });
    },
  });
  const balanceQ = useQuery({
    queryKey: ["trainer-balance"],
    queryFn: () => getTrainerBalance(),
  });
  const bal = balanceQ.data;
  const currency = bal?.currency ?? "USD";
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  const premiumCount = posts?.filter((p) => p.is_premium).length ?? 0;

  const postsGrid = (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg uppercase tracking-widest">Your Posts</h2>
        <span className="text-xs text-muted-foreground">
          {isLoading ? "…" : `${posts?.length ?? 0} total`}
        </span>
      </div>
      {isLoading ? (
        <PostsGridSkeleton count={6} />
      ) : postsError ? (
        <ErrorState
          title="Couldn't load your posts"
          message={postsErrObj instanceof Error ? postsErrObj.message : "Something went wrong."}
          onRetry={() => refetchPosts()}
          retrying={postsFetching}
        />
      ) : posts && posts.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
          {posts.map((p) => (
            <div
              key={p.id}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 transition-all hover:-translate-y-0.5 hover:border-primary/40"
            >
              <div className="relative aspect-square bg-muted">
                {p.thumbnail_url || p.media_url ? (
                  p.kind === "short" ? (
                    <video src={p.media_url} muted loop className="h-full w-full object-cover" />
                  ) : (
                    <img src={p.thumbnail_url ?? p.media_url} alt="" className="h-full w-full object-cover" />
                  )
                ) : null}
                {p.is_premium && (
                  <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary backdrop-blur">
                    <Lock className="h-3 w-3" /> Premium
                  </div>
                )}
                {p.kind === "short" && (
                  <div className="absolute left-2 top-2 rounded-full bg-background/85 p-1 backdrop-blur">
                    <Play className="h-3 w-3" />
                  </div>
                )}
              </div>
              <div className="p-3">
                {p.caption && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{p.caption}</p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => del.mutate(p.id)}
                    disabled={del.isPending}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="Delete post"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ImageIcon}
          title="No posts yet"
          message="Upload your first photo or short-form video above to start growing your community."
        />
      )}
    </section>
  );

  const widgets: WidgetDef[] = [
    {
      id: "stats",
      label: "Stats",
      render: () =>
        balanceQ.isLoading ? (
          <StatsRowSkeleton cols={4} />
        ) : balanceQ.isError ? (
          <ErrorState
            title="Couldn't load your balance"
            message={balanceQ.error instanceof Error ? balanceQ.error.message : "Something went wrong."}
            onRetry={() => balanceQ.refetch()}
            retrying={balanceQ.isFetching}
          />
        ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          <StatTile label="Available" value={fmt(bal?.available_amount ?? 0)} icon={Wallet} hint="Ready to withdraw" accent tone="emerald" />
          <StatTile label="Pending" value={fmt(bal?.pending_amount ?? 0)} icon={TrendingUp} hint="Clearing soon" tone="amber" />
          <StatTile label="Posts" value={posts?.length ?? 0} icon={ImageIcon} hint={`${premiumCount} premium`} tone="sky" />
          <StatTile label="Handle" value={username ? `@${username}` : "—"} icon={User} hint="Public profile" tone="violet" />
        </div>
        ),
    },
    {
      id: "quick-actions",
      label: "Quick actions",
      render: () => (
        <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
          <QuickAction to="/feed" label="Live Feed" icon={ImageIcon} description="See community activity" tone="sky" />
          <QuickAction to="/creator/dashboard" label="Creator Studio" icon={Rocket} description="Earnings & insights" tone="rose" />
          <QuickAction to="/messages" label="Messages" icon={Users} description="Fan DMs & Q&A" tone="teal" />
        </div>
      ),
    },
    { id: "post-composer", label: "New post", render: () => <PostComposer userId={userId} /> },
    { id: "onboarding-progress", label: "Onboarding progress", render: () => <OnboardingProgressCard /> },
    { id: "earnings", label: "Earnings", render: () => <TrainerEarningsCard /> },
    { id: "posts-grid", label: "Your posts", render: () => postsGrid },
  ];

  return <DashboardWidgets scope="trainer" widgets={widgets} />;
}

function DashboardError({ error }: { error: Error }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 text-center">
      <div className="max-w-md rounded-2xl border border-destructive/40 bg-destructive/5 p-8">
        <h1 className="text-xl font-semibold text-foreground">Couldn't load your dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Reload
        </Button>
      </div>
    </div>
  );
}

function TrainerEarningsCard() {
  const qc = useQueryClient();
  const balanceQ = useQuery({
    queryKey: ["trainer-balance"],
    queryFn: () => getTrainerBalance(),
  });
  const txQ = useQuery({
    queryKey: ["trainer-transactions"],
    queryFn: () => listTrainerTransactions(),
  });
  const payoutsQ = useQuery({
    queryKey: ["trainer-payouts"],
    queryFn: () => listMyPayouts(),
  });
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<"stripe" | "bank" | "paypal" | "other">("stripe");
  const [detail, setDetail] = useState("");
  const req = useServerFn(requestPayout);
  const mut = useMutation({
    mutationFn: () =>
      req({
        data: {
          amount,
          method,
          method_details: detail ? { destination: detail } : undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Payout requested");
      setAmount(0);
      setDetail("");
      qc.invalidateQueries({ queryKey: ["trainer-balance"] });
      qc.invalidateQueries({ queryKey: ["trainer-payouts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const bal = balanceQ.data;
  const currency = bal?.currency ?? "USD";
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  return (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
          <Wallet className="h-4 w-4" />
        </div>
        <h2 className="font-display text-lg uppercase tracking-widest">Earnings</h2>
      </div>

      {balanceQ.isLoading ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-md" />
          ))}
        </div>
      ) : balanceQ.isError ? (
        <ErrorState
          title="Couldn't load balance"
          message={balanceQ.error instanceof Error ? balanceQ.error.message : "Something went wrong."}
          onRetry={() => balanceQ.refetch()}
          retrying={balanceQ.isFetching}
        />
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <BalanceStat label="Available" value={fmt(bal?.available_amount ?? 0)} highlight />
          <BalanceStat label="Pending" value={fmt(bal?.pending_amount ?? 0)} />
          <BalanceStat label="Frozen" value={fmt(bal?.frozen_amount ?? 0)} />
          <BalanceStat label="Paid out" value={fmt(bal?.paid_out_amount ?? 0)} />
        </div>
      )}

      <div className="mt-6 rounded-md border border-border p-4">
        <h3 className="font-display text-sm uppercase tracking-widest">Request payout</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="payout-amount">Amount</Label>
            <Input
              id="payout-amount"
              type="number"
              min={0}
              step="1"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Method</Label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="stripe">Stripe</option>
              <option value="bank">Bank transfer</option>
              <option value="paypal">PayPal</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="payout-detail">Destination</Label>
            <Input
              id="payout-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="e.g. IBAN, PayPal email, Stripe account"
              className="mt-1"
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            disabled={mut.isPending || amount <= 0}
            onClick={() => mut.mutate()}
          >
            {mut.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Request Payout
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="font-display text-sm uppercase tracking-widest">Payout history</h3>
        {payoutsQ.isLoading ? (
          <ListRowsSkeleton rows={3} />
        ) : payoutsQ.isError ? (
          <ErrorState
            title="Couldn't load payouts"
            message={payoutsQ.error instanceof Error ? payoutsQ.error.message : "Something went wrong."}
            onRetry={() => payoutsQ.refetch()}
            retrying={payoutsQ.isFetching}
          />
        ) : payoutsQ.data && payoutsQ.data.length > 0 ? (
          <ul className="mt-2 divide-y divide-border rounded-md border border-border text-sm">
            {payoutsQ.data.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-3 py-2">
                <span>{fmt(p.amount)} · {p.method}</span>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-md border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
            No payouts yet. Request one above when you have available balance.
          </p>
        )}
      </div>

      <div className="mt-5">
        <h3 className="font-display text-sm uppercase tracking-widest">
          Recent transactions
        </h3>
        {txQ.isLoading ? (
          <ListRowsSkeleton rows={4} />
        ) : txQ.isError ? (
          <ErrorState
            title="Couldn't load transactions"
            message={txQ.error instanceof Error ? txQ.error.message : "Something went wrong."}
            onRetry={() => txQ.refetch()}
            retrying={txQ.isFetching}
          />
        ) : txQ.data && txQ.data.length > 0 ? (
          <ul className="mt-2 divide-y divide-border rounded-md border border-border text-sm">
            {txQ.data.slice(0, 8).map((t) => (
              <li key={t.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t.kind}
                  </p>
                  <p>{t.counterparty ?? "—"}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">+{fmt(t.trainer_amount)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-md border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
            No transactions yet.
          </p>
        )}
      </div>
    </section>
  );
}

function BalanceStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${
        highlight
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-background"
      }`}
    >
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 font-display text-lg ${highlight ? "text-primary" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function DashboardNotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Page not found</h1>
      </div>
    </div>
  );
}

function OnboardingProgressCard() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery(onboardingProgressQuery);

  return (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
          <ClipboardList className="h-4 w-4" />
        </div>
        <h2 className="font-display text-lg uppercase tracking-widest">Onboarding progress</h2>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3" aria-busy="true">
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 rounded-md" />
            ))}
          </div>
          <Skeleton className="h-24 rounded-md" />
        </div>
      ) : isError ? (
        <ErrorState
          title="Couldn't load your progress"
          message={error instanceof Error ? error.message : "Something went wrong."}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      ) : data ? (
        <div className="mt-4 space-y-5">
          <div>
            <div className="flex items-baseline justify-between">
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                {data.completedCount} of {data.totalSteps} complete
              </p>
              <p className="font-display text-sm text-primary">{data.percent}%</p>
            </div>
            <Progress value={data.percent} className="mt-2 h-2" />
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span
                className={`rounded-full border px-2 py-0.5 ${
                  data.onboardingCompleted
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border"
                }`}
              >
                Profile: {data.onboardingCompleted ? "Complete" : "In progress"}
              </span>
              {data.trainerApplicationStatus && (
                <span className="rounded-full border border-border px-2 py-0.5">
                  Trainer app: {data.trainerApplicationStatus}
                </span>
              )}
            </div>
          </div>

          <ul className="grid gap-2 sm:grid-cols-2">
            {data.steps.map((s) => (
              <li
                key={s.id}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  s.done
                    ? "border-primary/30 bg-primary/5 text-foreground"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {s.done ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
                <span>{s.label}</span>
              </li>
            ))}
          </ul>

          {!data.onboardingCompleted && (
            <div className="flex justify-end">
              <Link to="/onboarding" search={{ resume: true, source: "dashboard_banner" }}>
                <Button size="sm">Resume onboarding</Button>
              </Link>
            </div>
          )}

          <div>
            <h3 className="font-display text-sm uppercase tracking-widest">Recent activity</h3>
            {data.events.length === 0 ? (
              <p className="mt-2 rounded-md border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
                No onboarding activity yet.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-border rounded-md border border-border text-sm">
                {data.events.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{formatAction(e.action)}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {formatMeta(e.metadata)}
                      </p>
                    </div>
                    <time className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    "onboarding.skipped": "Skipped onboarding",
    "onboarding.resumed": "Resumed onboarding",
    "trainer_application.attempt": "Submitted trainer application",
    "trainer_application.success": "Trainer application accepted",
    "trainer_application.failure": "Trainer application error",
    "trainer_application.duplicate": "Trainer application already exists",
  };
  return map[action] ?? action;
}

function formatMeta(md: Record<string, string | number | boolean | null>): string {
  const parts: string[] = [];
  if (md.from_step) parts.push(`from ${md.from_step}`);
  if (md.source) parts.push(`via ${md.source}`);
  if (md.stage) parts.push(`stage: ${md.stage}`);
  if (md.existing_status) parts.push(`existing: ${md.existing_status}`);
  if (typeof md.specialties_count === "number") parts.push(`${md.specialties_count} specialties`);
  if (typeof md.years_experience === "number") parts.push(`${md.years_experience} yr exp`);
  return parts.join(" · ");
}
