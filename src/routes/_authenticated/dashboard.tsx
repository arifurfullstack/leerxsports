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
  Tag,
  Globe,
  Shield,
  AlertCircle,
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
  const { mode, switchMode, isCreator } = useProfileMode();

  const profileIncomplete = !state.profile?.username || !state.profile?.display_name;
  const greeting = getGreeting();
  const roleLabel =
    state.trainerApplication?.status === "pending"
      ? "Trainer Application Pending"
      : state.isTrainer
        ? "Trainer"
        : state.isAdmin
          ? "Admin"
          : "Trainee";

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
                {/* Profile Mode Switcher Toolbar Button (Visible for all users) */}
                <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-neutral-900/80 p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => switchMode("normal")}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                      mode === "normal"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <User className="h-3.5 w-3.5" /> Trainee View
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("creator")}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                      mode === "creator"
                        ? "bg-amber-500 text-black font-bold shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Trainer Studio
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

const GOAL_CHIPS = [
  "Hypertrophy & Muscle Gain",
  "Cut to 10-12% Body Fat",
  "Build Overall Strength",
  "Marathon & Endurance",
  "Body Recomp & Toning",
];

const PR_TEMPLATES = [
  "Bench 100kg",
  "Squat 140kg",
  "Deadlift 180kg",
  "Overhead Press 60kg",
  "5k Run 22:30",
];

const BIO_PROMPTS = [
  "Fitness enthusiast on a journey to peak performance.",
  "Training hard, eating clean, and tracking real transformation.",
  "Focused on strength gains, progressive overload & consistency.",
];

function ProfileSettingsCard() {
  const { data: state } = useSuspenseQuery(onboardingStateQuery);
  const p = state.profile as any;
  const [bio, setBio] = useState<string>(p?.bio ?? "");
  const [goal, setGoal] = useState<string>(p?.goal ?? "");
  const [prs, setPrs] = useState<string>(p?.personal_records ?? "");
  const [profileVis, setProfileVis] = useState<"public" | "subscribers" | "private">(
    (state.profile as any)?.profile_visibility ?? "public"
  );
  const [txVis, setTxVis] = useState<"public" | "subscribers" | "private">(
    (state.profile as any)?.transformation_visibility ?? "public"
  );
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
      toast.success("Profile & privacy settings updated! ✨");
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e: Error) => {
      setError(e.message);
      toast.error(e.message);
    },
  });

  const appendPr = (item: string) => {
    setPrs((prev) => {
      if (!prev.trim()) return item;
      if (prev.includes(item)) return prev;
      return `${prev.trim()}\n${item}`;
    });
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-black/80 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_0_50px_-20px_rgba(245,158,11,0.25)] space-y-6 transition-all duration-500">
      {/* Decorative ambient background glows */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

      {/* Header */}
      <div className="relative flex items-center justify-between border-b border-hairline/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500/20 via-rose-500/15 to-purple-600/20 border border-amber-500/30 text-amber-400 shadow-md">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold uppercase tracking-widest text-foreground">Profile &amp; Privacy</h2>
            <p className="text-xs text-muted-foreground">Manage your bio, goals, PRs, and default visibility rules.</p>
          </div>
        </div>
      </div>

      <div className="relative space-y-6">
        {/* Bio Section with Prompts */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="bio" className="text-xs font-bold uppercase tracking-wider text-foreground/90 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-amber-400" /> Bio &amp; Introduction
            </Label>
            <span className="text-[10px] font-medium text-muted-foreground">{bio.length}/500</span>
          </div>
          <Textarea
            id="bio"
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            className="rounded-2xl border-border/80 bg-neutral-900/80 p-3.5 text-xs text-foreground placeholder:text-muted-foreground/60 transition-all duration-300 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 shadow-inner"
            placeholder="Tell the community about yourself, your training style, and background..."
          />
          {/* Bio Quick Prompts */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Bio Ideas:
            </span>
            {BIO_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setBio(prompt)}
                className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-all duration-200 hover:border-amber-500/60 hover:bg-amber-500/15 hover:text-amber-300 hover:scale-105 active:scale-95 truncate max-w-[240px] sm:max-w-none shadow-sm"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Current Goal Section with Chips */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="goal" className="text-xs font-bold uppercase tracking-wider text-foreground/90 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-primary" /> Current Fitness Goal
            </Label>
            <span className="text-[10px] font-medium text-muted-foreground">e.g. Cut, Bulk, Recomp</span>
          </div>
          <Input
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="h-11 rounded-2xl border-border/80 bg-neutral-900/80 px-4 text-xs font-medium text-foreground transition-all duration-300 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 shadow-inner"
            placeholder="e.g. Cut to 12% body fat by June"
          />
          {/* Goal Quick Chips */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
              <Tag className="h-3 w-3" /> Popular Goals:
            </span>
            {GOAL_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setGoal(chip)}
                className={`rounded-xl border px-3 py-1 text-[10px] font-semibold transition-all duration-200 hover:scale-105 active:scale-95 ${
                  goal === chip
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_0_15px_-3px_var(--primary)]"
                    : "border-border/60 bg-muted/30 text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-foreground"
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Personal Records Section with Templates */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="prs" className="text-xs font-bold uppercase tracking-wider text-foreground/90 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Personal Records (PRs)
            </Label>
            <span className="text-[10px] font-medium text-muted-foreground">SBD &amp; Key Lifts</span>
          </div>
          <Textarea
            id="prs"
            rows={3}
            value={prs}
            onChange={(e) => setPrs(e.target.value)}
            className="rounded-2xl border-border/80 bg-neutral-900/80 p-3.5 text-xs font-mono text-foreground transition-all duration-300 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 shadow-inner"
            placeholder="Bench 100kg&#10;Squat 140kg&#10;Deadlift 180kg"
          />
          {/* PR Quick Template Chips */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
              <Tag className="h-3 w-3" /> Insert Template:
            </span>
            {PR_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl}
                type="button"
                onClick={() => appendPr(tmpl)}
                className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-all duration-200 hover:border-amber-500/60 hover:bg-amber-500/15 hover:text-amber-300 hover:scale-105 active:scale-95 shadow-sm"
              >
                + {tmpl}
              </button>
            ))}
          </div>
        </div>

        {/* Visibility Pill Selectors */}
        <div className="grid gap-5 sm:grid-cols-2 pt-2">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-foreground/90 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-sky-400" /> Profile Visibility
            </Label>
            <div className="flex flex-col gap-2.5">
              {[
                { value: "public", label: "Public", desc: "Visible to all members & guests", icon: Globe },
                { value: "subscribers", label: "Subscribers Only", desc: "Visible only to active subscribers", icon: Lock },
                { value: "private", label: "Private", desc: "Visible only to you", icon: Shield },
              ].map((v) => {
                const Icon = v.icon;
                return (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => setProfileVis(v.value as any)}
                    className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                      profileVis === v.value
                        ? "border-sky-400/60 bg-gradient-to-r from-sky-500/20 via-sky-500/10 to-transparent text-sky-300 shadow-[0_0_20px_-5px_rgba(56,189,248,0.3)]"
                        : "border-border/60 bg-neutral-900/60 text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold">{v.label}</p>
                      <p className="text-[10px] opacity-80">{v.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-foreground/90 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-amber-400" /> Transformation Visibility
            </Label>
            <div className="flex flex-col gap-2.5">
              {[
                { value: "public", label: "Public", desc: "Visible on community feed", icon: Globe },
                { value: "subscribers", label: "Trainer Only", desc: "Visible to your trainer for coaching", icon: Lock },
                { value: "private", label: "Private", desc: "Saved privately in your vault", icon: Shield },
              ].map((v) => {
                const Icon = v.icon;
                return (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => setTxVis(v.value as any)}
                    className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                      txVis === v.value
                        ? "border-amber-400/60 bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent text-amber-300 shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)]"
                        : "border-border/60 bg-neutral-900/60 text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold">{v.label}</p>
                      <p className="text-[10px] opacity-80">{v.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-destructive/50 bg-destructive/10 p-3.5 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-hairline/60">
          {saved && <span className="text-xs font-bold text-emerald-400 animate-pulse">✓ Changes Saved Successfully</span>}
          <Button
            size="sm"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 px-7 py-2.5 font-bold uppercase tracking-wider text-black shadow-[0_0_25px_-5px_rgba(245,158,11,0.5)] transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-[0_0_35px_-5px_rgba(245,158,11,0.7)] disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
          </Button>
        </div>
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
    <section className="relative overflow-hidden rounded-3xl border border-red-500/30 bg-black/90 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_0_50px_-20px_rgba(239,68,68,0.3)] space-y-6 transition-all duration-500">
      {/* Decorative Gymshark red ambient background glows */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-red-600/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-rose-600/10 blur-3xl" />

      {/* Header */}
      <div className="relative flex items-center justify-between border-b border-hairline/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-red-600/30 via-rose-500/20 to-orange-500/20 border border-red-500/40 text-red-400 shadow-[0_0_20px_-3px_rgba(239,68,68,0.4)]">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-black uppercase tracking-widest text-foreground flex items-center gap-2">
              Onboarding Progress <span className="rounded-md bg-red-600/20 px-2 py-0.5 text-[10px] font-bold text-red-400 border border-red-500/30">GYMSHARK STYLE</span>
            </h2>
            <p className="text-xs text-muted-foreground">Complete your profile setup to unlock full platform features &amp; trainer tools.</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-4" aria-busy="true">
          <Skeleton className="h-4 w-full rounded-full" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : isError ? (
        <ErrorState
          title="Couldn't load your progress"
          message={error instanceof Error ? error.message : "Something went wrong."}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      ) : data ? (
        <div className="relative space-y-6">
          {/* Progress Bar & Header Stats */}
          <div className="space-y-2.5 rounded-2xl border border-red-500/30 bg-neutral-900/80 p-4 shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-foreground">
                  {data.completedCount} of {data.totalSteps} Steps Complete
                </span>
              </div>
              <span className="font-display text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-400 to-orange-400">
                {data.percent}%
              </span>
            </div>

            {/* Gymshark Crimson Red Glowing Progress Bar */}
            <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-neutral-950 p-0.5 border border-red-500/30">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-600 via-rose-500 to-orange-500 transition-all duration-700 ease-out shadow-[0_0_20px_rgba(239,68,68,0.75)]"
                style={{ width: `${data.percent}%` }}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
              <span
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1 transition-all ${
                  data.onboardingCompleted
                    ? "border-red-500/60 bg-red-600/20 text-red-300 shadow-[0_0_15px_-3px_rgba(239,68,68,0.4)]"
                    : "border-orange-500/60 bg-orange-500/20 text-orange-300 shadow-[0_0_15px_-3px_rgba(249,115,22,0.4)]"
                }`}
              >
                {data.onboardingCompleted ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-red-400" /> Profile Setup Complete
                  </>
                ) : (
                  <>
                    <Circle className="h-3.5 w-3.5 text-orange-400" /> Setup In Progress
                  </>
                )}
              </span>

              {data.trainerApplicationStatus && (
                <span className="flex items-center gap-1.5 rounded-xl border border-red-500/50 bg-red-600/15 px-3 py-1 text-red-300 shadow-[0_0_15px_-3px_rgba(239,68,68,0.3)]">
                  <BadgeCheck className="h-3.5 w-3.5 text-red-400" /> Trainer App: {data.trainerApplicationStatus}
                </span>
              )}
            </div>
          </div>

          {/* Gymshark Red Checklist Steps Grid */}
          <div>
            <Label className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-red-500" /> Gymshark Checklist Steps
            </Label>
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.steps.map((s) => (
                <li
                  key={s.id}
                  className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition-all duration-300 hover:scale-[1.02] ${
                    s.done
                      ? "border-red-500/60 bg-gradient-to-r from-red-600/25 via-rose-500/15 to-neutral-900/80 text-red-200 shadow-[0_0_25px_-5px_rgba(239,68,68,0.35)]"
                      : "border-neutral-800 bg-neutral-900/60 text-muted-foreground shadow-sm hover:border-neutral-700"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-transform duration-300 ${
                        s.done
                          ? "border-red-500 bg-red-600/30 text-white shadow-[0_0_12px_rgba(239,68,68,0.6)]"
                          : "border-neutral-700 bg-neutral-800 text-muted-foreground"
                      }`}
                    >
                      {s.done ? <Check className="h-4 w-4 stroke-[3]" /> : <Circle className="h-4 w-4" />}
                    </div>
                    <span className={`text-xs font-bold truncate ${s.done ? "text-foreground" : "text-muted-foreground"}`}>
                      {s.label}
                    </span>
                  </div>

                  {!s.done && (
                    <Link
                      to="/onboarding"
                      search={{ resume: true, source: "dashboard_step" }}
                      className="shrink-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] transition-all hover:scale-105 hover:from-red-500 hover:to-rose-500"
                    >
                      Complete &rarr;
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Gymshark Banner */}
          {!data.onboardingCompleted && (
            <div className="flex items-center justify-between rounded-2xl border border-red-500/50 bg-gradient-to-r from-red-600/20 via-rose-600/10 to-transparent p-4 shadow-[0_0_30px_-5px_rgba(239,68,68,0.25)]">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-red-400">Incomplete Onboarding Steps</p>
                <p className="text-[11px] text-muted-foreground">Finish your setup to unlock all pro capabilities.</p>
              </div>
              <Link to="/onboarding" search={{ resume: true, source: "dashboard_banner" }}>
                <Button size="sm" className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 font-black uppercase tracking-wider text-white hover:from-red-500 hover:to-rose-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]">
                  Resume Onboarding
                </Button>
              </Link>
            </div>
          )}

          {/* Gymshark Activity Section */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5 text-red-500" /> Recent Onboarding Activity
            </h3>
            {data.events.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/40 p-4 text-center text-xs text-muted-foreground">
                No onboarding activity logged yet.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-800/80 rounded-2xl border border-neutral-800 bg-neutral-900/60 text-xs">
                {data.events.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 p-3.5 hover:bg-neutral-900/90 transition-colors">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-foreground">{formatAction(e.action)}</p>
                      {formatMeta(e.metadata) && (
                        <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                          {formatMeta(e.metadata)}
                        </p>
                      )}
                    </div>
                    <time className="shrink-0 text-[10px] uppercase font-medium text-muted-foreground">
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
