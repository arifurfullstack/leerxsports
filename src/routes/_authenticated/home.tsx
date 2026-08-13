import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  queryOptions,
  useSuspenseQuery,
  useQuery,
  useQueryClient,
  useMutation,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as React from "react";
import { toast } from "sonner";
import {
  Home,
  Bell,
  MessageSquare,
  Compass,
  Film,
  Newspaper,
  Users,
  Bookmark,
  HelpCircle,
  LayoutDashboard,
  Settings as SettingsIcon,
  UserCircle,
  Plus,
  Search,
  Play,
  Heart,
  Dumbbell,
  BadgeCheck,
  Zap,
  Lock,
  Sparkles,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  MessageCircle,
  Share2,
  Check,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
} from "lucide-react";
import {
  getDiscoveryFeed,
  getShortsFeed,
  getSpotlightTrainers,
} from "@/lib/trainer-functions";
import { getOnboardingState } from "@/lib/onboarding-functions";
import {
  toggleRespect,
  toggleSave,
  logShare,
  getViewerEngagementBatch,
} from "@/lib/engagement-functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import { SmartImage } from "@/components/smart-image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { useSidebarBadges } from "@/hooks/use-sidebar-badges";
import { StoryViewer, type StoryReel } from "@/components/story-viewer";
import { StoryComposerDialog } from "@/components/story-composer-dialog";
import {
  listActiveStories,
  recordStoryView,
  deleteStory,
  type ActiveStoryReel,
} from "@/lib/story-functions";
import { ReelPlayer, type ReelItem } from "@/components/reel-player";
import { PostDetailDialog } from "@/components/post-detail-dialog";
import { ShareSheet } from "@/components/share-sheet";
import { CreatePostDialog } from "@/components/create-post-dialog";

type FeedItem = Awaited<ReturnType<typeof getDiscoveryFeed>>[number];

// -------- Query options -------------------------------------------------

const feedQ = queryOptions({
  queryKey: ["home", "discovery-feed"],
  queryFn: async () => {
    try {
      return await getDiscoveryFeed();
    } catch (err) {
      console.error("[home] feedQ error:", err);
      return [];
    }
  },
  staleTime: 0,
});
const reelsQ = queryOptions({
  queryKey: ["home", "shorts-feed"],
  queryFn: async () => {
    try {
      return await getShortsFeed();
    } catch (err) {
      console.error("[home] reelsQ error:", err);
      return [];
    }
  },
  staleTime: 0,
});
const spotlightQ = queryOptions({
  queryKey: ["home", "spotlight-trainers"],
  queryFn: async () => {
    try {
      return await getSpotlightTrainers();
    } catch (err) {
      console.error("[home] spotlightQ error:", err);
      return [];
    }
  },
  staleTime: 5 * 60_000,
});
const meQ = queryOptions({
  queryKey: ["onboarding-state"],
  queryFn: async () => {
    try {
      return await getOnboardingState();
    } catch (err) {
      console.error("[home] meQ error:", err);
      return null;
    }
  },
});
const storiesQ = queryOptions({
  queryKey: ["stories", "active"],
  queryFn: async () => {
    try {
      return await listActiveStories();
    } catch (err) {
      console.error("[home] storiesQ error:", err);
      return [];
    }
  },
  staleTime: 30_000,
});

const homeSearchSchema = z.object({
  story: z.string().optional(),
});

// -------- Route ---------------------------------------------------------

export const Route = createFileRoute("/_authenticated/home")({
  validateSearch: zodValidator(homeSearchSchema),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(feedQ),
      context.queryClient.ensureQueryData(reelsQ),
      context.queryClient.ensureQueryData(spotlightQ),
      context.queryClient.ensureQueryData(meQ),
      context.queryClient.ensureQueryData(storiesQ),
    ]),
  head: () => ({
    meta: [
      { title: "Home — LEER" },
      {
        name: "description",
        content:
          "Your LEER home feed: stories from creators you follow, fresh reels, and posts curated for you.",
      },
      { property: "og:title", content: "Home — LEER" },
      {
        property: "og:description",
        content: "Stories, reels, and posts from creators you follow on LEER.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  pendingComponent: HomePending,
  component: HomePage,
  errorComponent: HomeError,
  notFoundComponent: HomeNotFound,
});

function HomePending() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-6">
      <div className="flex items-center justify-center gap-3 text-muted-foreground py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-sm font-medium tracking-wide">Loading your LEER home feed…</span>
      </div>
      <div className="grid w-full gap-6 md:grid-cols-[64px_minmax(0,1fr)_260px] lg:grid-cols-[200px_minmax(0,1fr)_260px]">
        <div className="hidden space-y-4 md:block">
          <div className="h-10 w-full animate-pulse rounded-xl bg-card/60" />
          <div className="h-40 w-full animate-pulse rounded-xl bg-card/60" />
        </div>
        <div className="space-y-6">
          <div className="flex gap-4 overflow-hidden py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="h-16 w-16 animate-pulse rounded-full bg-card/80 ring-2 ring-primary/20" />
                <div className="h-3 w-12 animate-pulse rounded bg-card/60" />
              </div>
            ))}
          </div>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-4 rounded-2xl border border-white/5 bg-card/50 p-4 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-card/80" />
                <div className="space-y-1.5">
                  <div className="h-4 w-32 animate-pulse rounded bg-card/80" />
                  <div className="h-3 w-20 animate-pulse rounded bg-card/60" />
                </div>
              </div>
              <div className="h-64 w-full animate-pulse rounded-xl bg-card/80" />
            </div>
          ))}
        </div>
        <div className="hidden space-y-4 md:block">
          <div className="h-10 w-full animate-pulse rounded-full bg-card/60" />
          <div className="h-56 w-full animate-pulse rounded-2xl bg-card/60" />
        </div>
      </div>
    </div>
  );
}

function HomeError({ reset }: { error: unknown; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <p className="mb-4 text-sm text-muted-foreground">
        Something went wrong loading your home feed.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
function HomeNotFound() {
  return (
    <div className="mx-auto max-w-md p-8 text-center text-sm text-muted-foreground">
      Page not found.
    </div>
  );
}

// -------- Page ----------------------------------------------------------

function HomePage() {
  const [collapsed, , toggleCollapsed] = useSidebarCollapsed();
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const openCreate = () => setCreateOpen(true);
  return (
    <TooltipProvider delayDuration={200}>
      <CreatePostDialog open={createOpen} onOpenChange={setCreateOpen} />
      <div
        data-home-shell
        className={cn(
          "mx-auto grid w-full min-w-0 max-w-full gap-0 px-0 pb-0 pt-0",
          // Mobile: single column, natural page scroll
          "grid-cols-[minmax(0,1fr)]",
          // Tablet and up: 3-column shell with responsive rails
          "md:h-[calc(100dvh-4rem)] md:overflow-hidden md:gap-4 md:grid-cols-[64px_minmax(0,1fr)_64px] md:px-3 md:pb-4 md:pt-2",
          "transition-[grid-template-columns,gap,padding,max-width] duration-300 ease-out motion-reduce:transition-none",
          "lg:gap-5 lg:px-5",
          "xl:gap-6 xl:px-6",
          collapsed
            ? [
                "lg:grid-cols-[64px_minmax(0,1fr)_clamp(200px,20vw,250px)]",
                "xl:grid-cols-[72px_minmax(0,1fr)_clamp(230px,19vw,280px)]",
                "2xl:grid-cols-[76px_minmax(0,1fr)_clamp(250px,18vw,300px)]",
              ]
            : [
                "lg:grid-cols-[clamp(180px,16vw,210px)_minmax(0,1fr)_clamp(200px,20vw,250px)]",
                "xl:grid-cols-[clamp(210px,16vw,240px)_minmax(0,1fr)_clamp(230px,19vw,280px)]",
                "2xl:grid-cols-[clamp(230px,15vw,260px)_minmax(0,1fr)_clamp(250px,18vw,300px)]",
              ],
        )}
        style={previewWidth ? { maxWidth: `${previewWidth}px` } : undefined}
      >
        {/* Desktop / tablet sidebar — hidden on mobile (Instagram-style) */}
        <aside className="hidden h-full min-h-0 self-start overflow-hidden md:block">
          <div className="h-full overflow-y-auto overscroll-contain pr-1 pt-3 pb-4 sm:pt-4 sm:pb-6 lg:pt-5 lg:pb-8 scrollbar-none">
            <div className="hidden lg:block">
              <LeftSidebar variant={collapsed ? "rail" : "full"} collapsed={collapsed} onCreate={openCreate} />
            </div>
            <div className="lg:hidden">
              <LeftSidebar variant="rail" onCreate={openCreate} />
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-4 px-2 pt-3 pb-24 md:h-full md:min-h-0 md:space-y-8 md:overflow-y-auto md:overscroll-contain scrollbar-none md:px-0 md:pt-0 md:pb-8 md:pr-1">
          <StoriesRail />
          <ReelsRail />
          <FeedGrid />
        </main>

        <aside className="hidden h-full min-h-0 self-start overflow-hidden md:block">
          <div className="h-full space-y-4 overflow-y-auto overscroll-contain pr-1 pt-3 pb-4 sm:pt-4 sm:pb-6 lg:pt-5 lg:pb-8 scrollbar-none">
            <div className="hidden lg:block">
              <RightSidebar />
            </div>
            <div className="lg:hidden">
              <RightRail />
            </div>
          </div>
        </aside>
      </div>
      <MobileBottomTabBar onCreate={openCreate} />
      <FloatingCreateFAB onCreate={openCreate} />
    </TooltipProvider>
  );
}

function FloatingCreateFAB({ onCreate }: { onCreate?: () => void }) {
  return (
    <div className="fixed bottom-20 right-5 z-50 md:bottom-8 md:right-8 group">
      {/* Glowing background ring */}
      <div className="pointer-events-none absolute -inset-2 rounded-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 opacity-60 blur-lg transition-all duration-300 group-hover:opacity-100 group-hover:blur-xl animate-pulse" />
      
      <button
        type="button"
        onClick={onCreate}
        aria-label="Create Post or Log Transformation"
        className="relative flex items-center gap-2.5 rounded-full border border-red-400/40 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 px-5 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-[0_0_35px_rgba(239,68,68,0.75)] transition-all duration-300 hover:scale-110 active:scale-95 hover:shadow-[0_0_45px_rgba(239,68,68,0.95)]"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white shadow-inner transition-transform group-hover:rotate-90">
          <Plus className="h-4 w-4 stroke-[3]" />
        </span>
        <span className="hidden sm:inline font-display">CREATE</span>
      </button>
    </div>
  );
}

// -------- Left sidebar --------------------------------------------------

function LayoutPreview({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const modes = [
    { key: "expanded" as const, label: "Expanded", value: false },
    { key: "compact" as const, label: "Compact", value: true },
  ];
  const current = collapsed ? "compact" : "expanded";
  return (
    <div className="hidden items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/60 p-2 pl-3 backdrop-blur lg:flex">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        <span>Layout</span>
      </div>
      <div
        role="group"
        aria-label="Sidebar layout"
        className="flex items-center gap-1.5"
      >
        {modes.map((m) => {
          const active = current === m.key;
          return (
            <button
              key={m.key}
              type="button"
              aria-pressed={active}
              onClick={() => {
                if (m.value !== collapsed) onToggle();
              }}
              className={cn(
                "group/preview inline-flex items-center gap-2 rounded-xl border px-2 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                active
                  ? "border-primary/60 bg-primary/10 text-foreground shadow-[0_0_0_1px_var(--primary)]"
                  : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground",
              )}
            >
              {/* mini schematic */}
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-6 items-stretch gap-[3px] rounded-md border border-border/60 bg-background/60 p-[3px]",
                )}
              >
                <span
                  className={cn(
                    "rounded-sm bg-primary/70 transition-all",
                    m.value ? "w-1.5" : "w-3",
                  )}
                />
                <span className="w-6 rounded-sm bg-muted-foreground/30" />
                <span className="w-2 rounded-sm bg-muted-foreground/20" />
              </span>
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// -------- Horizontal scroll rail with arrow controls -------------------

function BreakpointPreview({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const options: Array<{ key: string; label: string; width: number | null }> = [
    { key: "md", label: "md", width: 768 },
    { key: "lg", label: "lg", width: 1024 },
    { key: "xl", label: "xl", width: 1280 },
    { key: "2xl", label: "2xl", width: 1536 },
    { key: "full", label: "Full", width: null },
  ];
  const currentKey =
    options.find((o) => o.width === value)?.key ?? (value === null ? "full" : "custom");
  return (
    <div className="hidden items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/60 p-2 pl-3 backdrop-blur lg:flex">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        <span>Breakpoint</span>
        {value ? (
          <span className="rounded-md border border-border/60 bg-background/40 px-1.5 py-0.5 text-foreground">
            {value}px
          </span>
        ) : null}
      </div>
      <div
        role="group"
        aria-label="Preview breakpoint width"
        className="flex flex-wrap items-center gap-1.5"
      >
        {options.map((o) => {
          const active = currentKey === o.key;
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.width)}
              className={cn(
                "inline-flex min-w-[44px] items-center justify-center rounded-xl border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                active
                  ? "border-primary/60 bg-primary/10 text-foreground shadow-[0_0_0_1px_var(--primary)]"
                  : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScrollRail({
  children,
  className,
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c as Element));
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update, children]);

  const scrollByAmt = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  };

  return (
    <div className="group/rail relative">
      <div
        ref={ref}
        aria-label={ariaLabel}
        className={cn(
          "scrollbar-none -mx-3 flex snap-x snap-mandatory overflow-x-auto scroll-smooth px-3 pb-2",
          className,
        )}
      >
        {children}
      </div>

      {/* Fade masks */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-background to-transparent transition-opacity duration-200",
          canLeft ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent transition-opacity duration-200",
          canRight ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Arrow buttons — desktop only, appear on hover */}
      <button
        type="button"
        onClick={() => scrollByAmt(-1)}
        aria-label="Scroll left"
        tabIndex={canLeft ? 0 : -1}
        className={cn(
          "absolute left-1 top-1/2 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-border/60 bg-background/90 text-foreground shadow-lg backdrop-blur transition md:grid",
          "hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          canLeft
            ? "opacity-0 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100"
            : "pointer-events-none opacity-0",
        )}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => scrollByAmt(1)}
        aria-label="Scroll right"
        tabIndex={canRight ? 0 : -1}
        className={cn(
          "absolute right-1 top-1/2 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-border/60 bg-background/90 text-foreground shadow-lg backdrop-blur transition md:grid",
          "hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          canRight
            ? "opacity-0 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100"
            : "pointer-events-none opacity-0",
        )}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}


type NavItem = { to: string; label: string; icon: typeof Home; badge?: string; hint: string };
type NavSection = { label: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Discover",
    items: [
      { to: "/home", label: "Home", icon: Home, hint: "Your personalized feed" },
      { to: "/explore", label: "Explore", icon: Compass, hint: "Discover trending creators & posts" },
      { to: "/feed", label: "Feed", icon: Newspaper, hint: "Latest from people you follow" },
      { to: "/shorts", label: "Reels", icon: Film, hint: "Short-form video reels" },
      { to: "/community", label: "Community", icon: Users, hint: "Public discussions & Q&A" },
    ],
  },
  {
    label: "You",
    items: [
      { to: "/notifications", label: "Notifications", icon: Bell, hint: "Alerts, mentions & replies" },
      { to: "/messages", label: "Messages", icon: MessageSquare, hint: "Direct messages" },
      { to: "/library", label: "Bookmarks", icon: Bookmark, hint: "Saved posts & reels" },
      { to: "/qa", label: "Q&A", icon: HelpCircle, hint: "Ask & answer questions" },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, hint: "Your stats & activity" },
      { to: "/profile", label: "My profile", icon: UserCircle, hint: "View your public profile" },
      { to: "/settings", label: "Settings", icon: SettingsIcon, hint: "Account & preferences" },
    ],
  },
];

function useCurrentPath() {
  return useRouterState({ select: (s) => s.location.pathname });
}

function LeftSidebar({
  variant = "full",
  onNavigate,
  onToggle,
  collapsed,
  onCreate,
}: {
  variant?: "full" | "rail";
  onNavigate?: () => void;
  onToggle?: () => void;
  collapsed?: boolean;
  onCreate?: () => void;
}) {
  const { data: me } = useSuspenseQuery(meQ);
  const userMeta = me?.userMetadata as Record<string, string> | null;
  const name = me?.profile?.display_name || me?.profile?.full_name || userMeta?.full_name || userMeta?.name || "You";
  const handle = me?.profile?.username ? `@${me.profile.username}` : "@you";
  const avatarUrl =
    (me?.profile?.avatar_url as string | null) ||
    (me?.profile?.avatar_urls as { sm?: string; md?: string; lg?: string } | null)?.md ||
    (me?.profile?.avatar_urls as { sm?: string; md?: string; lg?: string } | null)?.sm ||
    (me?.profile?.avatar_urls as { sm?: string; md?: string; lg?: string } | null)?.lg ||
    userMeta?.avatar_url ||
    userMeta?.picture ||
    null;
  const pathname = useCurrentPath();
  const rail = variant === "rail";
  const badges = useSidebarBadges(me?.userId ?? null);
  const liveBadgeFor = (to: string): { text: string; a11y: string } | null => {
    const map: Record<string, { count: number; noun: string }> = {
      "/notifications": { count: badges.notifications, noun: "unread notifications" },
      "/messages": { count: badges.messages, noun: "unread messages" },
    };
    const entry = map[to];
    if (!entry || entry.count <= 0) return null;
    return {
      text: entry.count > 99 ? "99+" : String(entry.count),
      a11y: `${entry.count} ${entry.noun}`,
    };
  };
  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "relative flex flex-col gap-3",
        rail
          ? "items-center rounded-3xl border border-border/50 bg-card/40 p-2 backdrop-blur"
          : "rounded-3xl border border-border/50 bg-gradient-to-b from-card/80 to-card/30 p-3 backdrop-blur-xl shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset]",
      )}
    >
      {/* User card */}
      {rail ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/profile"
              onClick={onNavigate}
              className={cn(
                "relative grid h-11 w-11 place-items-center rounded-2xl transition hover:bg-muted/60",
                focusRing,
              )}
              aria-label={`${name} profile`}
            >
              <UserAvatar
                src={avatarUrl}
                name={name}
                size="sm"
                isTrainer={me?.isTrainer}
              />
              <span
                aria-hidden="true"
                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500"
              />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">{name}</TooltipContent>
        </Tooltip>
      ) : (
        <Link
          to="/profile"
          onClick={onNavigate}
          aria-label={`${name} profile`}
          className={cn(
            "group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border/40 bg-background/60 p-3 transition hover:border-primary/40 hover:bg-background",
            focusRing,
          )}
        >
          <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br from-primary/20 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
          <div className="relative">
            <UserAvatar
              src={avatarUrl}
              name={name}
              size="md"
              isTrainer={me?.isTrainer}
            />
            <span
              aria-hidden="true"
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-500"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{handle}</p>
          </div>
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground"
          />
        </Link>
      )}

      {/* Sections */}
      <div id="primary-nav-sections" className={cn("flex flex-col gap-4", rail ? "w-full" : "gap-5")}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} role="group" aria-labelledby={`nav-sec-${section.label}`} className="flex flex-col gap-1">
            {rail ? (
              <h3 id={`nav-sec-${section.label}`} className="sr-only">
                {section.label}
              </h3>
            ) : (
              <h3
                id={`nav-sec-${section.label}`}
                className="px-3 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/70"
              >
                {section.label}
              </h3>
            )}
            <ul className={cn("flex flex-col gap-1", rail && "items-center")}>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.to ||
                  (item.to !== "/home" && pathname.startsWith(item.to + "/"));
                const live = liveBadgeFor(item.to);
                const badgeText = live?.text ?? item.badge ?? null;
                const badgeLabel = live?.a11y ?? (item.badge ? `${item.badge} unread` : undefined);
                const linkEl = (
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    aria-label={badgeLabel ? `${item.label}, ${badgeLabel}` : item.label}
                    className={cn(
                      "group relative flex items-center transition",
                      focusRing,
                      rail
                        ? "h-11 w-11 justify-center rounded-2xl"
                        : "gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold",
                      active
                        ? rail
                          ? "bg-primary/15 text-primary"
                          : "bg-primary/10 text-primary"
                        : "text-foreground/75 hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute rounded-full bg-primary shadow-[0_0_12px_2px_hsl(var(--primary)/0.5)]",
                          rail ? "left-0 top-1/2 h-6 w-[3px] -translate-y-1/2" : "left-0 top-1/2 h-6 w-[3px] -translate-x-1 -translate-y-1/2",
                        )}
                      />
                    )}
                    <Icon className={cn("shrink-0", rail ? "h-5 w-5" : "h-[18px] w-[18px]")} aria-hidden="true" />
                    {!rail && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                    {badgeText && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "inline-flex items-center justify-center rounded-full bg-primary font-black text-primary-foreground",
                          rail
                            ? "absolute right-0.5 top-0.5 h-4 min-w-4 px-1 text-[9px]"
                            : "h-5 min-w-5 px-1.5 text-[10px]",
                        )}
                      >
                        {badgeText}
                      </span>
                    )}
                  </Link>
                );
                return (
                  <li key={item.to} className={rail ? "" : "w-full"}>
                    <Tooltip delayDuration={rail ? 100 : 400}>
                      <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[220px]">
                        <p className="text-xs font-bold">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground">{item.hint}</p>
                      </TooltipContent>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div aria-hidden="true" role="presentation" className={cn("mt-1 h-px w-full bg-border/60", rail && "mx-auto w-8")} />

      {/* Sticky CTAs */}
      <div
        role="group"
        aria-label="Quick actions"
        className={cn(
          "sticky bottom-0 z-20 mt-auto pt-2 pb-1 backdrop-blur-2xl bg-black/90 border-t border-red-500/20 rounded-b-3xl",
          rail ? "flex flex-col items-center gap-2" : "flex flex-col gap-2"
        )}
      >
        {rail ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  onNavigate?.();
                  onCreate?.();
                }}
                aria-label="Create"
                className={cn(
                  "relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-[0_0_25px_rgba(239,68,68,0.7)] transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-[0_0_35px_rgba(239,68,68,0.9)] border border-red-500/40",
                  focusRing,
                )}
              >
                <Plus aria-hidden="true" className="h-6 w-6 stroke-[3] text-white" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Create</TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              onCreate?.();
            }}
            className={cn(
              "group relative flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 px-4 text-xs font-black uppercase tracking-[0.2em] text-white shadow-[0_0_30px_rgba(239,68,68,0.7)] transition-all duration-300 hover:scale-[1.03] active:scale-95 hover:shadow-[0_0_40px_rgba(239,68,68,0.9)] border border-red-400/40",
              focusRing,
            )}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-xl bg-white/20 text-white shadow-inner transition-transform group-hover:rotate-90">
              <Plus aria-hidden="true" className="h-4 w-4 stroke-[3]" />
            </span>
            <span>Create</span>
          </button>
        )}
      </div>
    </nav>
  );
}

function MobileNavBar({ onCreate }: { onCreate?: () => void }) {
  return <MobileNavBarImpl onCreate={onCreate} />;
}

// Instagram-style fixed bottom tab bar (mobile only)
function MobileBottomTabBar({ onCreate }: { onCreate?: () => void }) {
  const path = useCurrentPath();
  const { data: me } = useQuery(meQ);
  const userMeta = me?.userMetadata as Record<string, string> | null;
  const avatarUrl =
    (me?.profile?.avatar_url as string | null) ||
    (me?.profile?.avatar_urls as { sm?: string; md?: string; lg?: string } | null)?.sm ||
    (me?.profile?.avatar_urls as { sm?: string; md?: string; lg?: string } | null)?.md ||
    userMeta?.avatar_url ||
    userMeta?.picture ||
    null;
  const displayName =
    me?.profile?.display_name || me?.profile?.full_name || userMeta?.full_name || "You";

  const tabs: Array<{
    key: string;
    to?: string;
    label: string;
    icon: typeof Home;
    match?: (p: string) => boolean;
    onClick?: () => void;
  }> = [
    { key: "home", to: "/home", label: "Home", icon: Home, match: (p) => p === "/home" },
    { key: "explore", to: "/explore", label: "Search", icon: Search, match: (p) => p.startsWith("/explore") },
    { key: "create", label: "Create", icon: Plus, onClick: () => onCreate?.() },
    { key: "reels", to: "/shorts", label: "Reels", icon: Film, match: (p) => p.startsWith("/shorts") },
  ];

  const profileActive = path.startsWith("/profile");

  const tapHaptic = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(8);
      } catch {
        /* no-op */
      }
    }
  };

  const cellBase =
    "group relative flex h-14 w-full items-center justify-center outline-none transition-transform duration-150 active:scale-[0.92] focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 md:hidden",
        "border-t border-hairline-strong bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80",
        "pb-[max(env(safe-area-inset-bottom),0.25rem)]",
      )}
    >
      <ul className="grid grid-cols-5 items-stretch">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = t.match ? t.match(path) : false;
          const inner = (
            <>
              {/* Active indicator pill — never affects layout */}
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute left-1/2 top-1 h-1 w-6 -translate-x-1/2 rounded-full bg-foreground transition-all duration-300 ease-out",
                  active ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0",
                )}
              />
              <span
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-widest transition-colors duration-200",
                  active ? "text-foreground" : "text-foreground/55 group-hover:text-foreground/80",
                )}
              >
                <Icon
                  className={cn(
                    "h-6 w-6 transition-all duration-200 ease-out",
                    active ? "scale-110" : "scale-100",
                    t.key === "create"
                      ? "rounded-md border border-hairline-strong p-0.5"
                      : "",
                  )}
                  strokeWidth={2}
                  fill={active && t.key !== "create" ? "currentColor" : "none"}
                />
                <span className="sr-only">{t.label}</span>
              </span>
            </>
          );
          return (
            <li key={t.key} className="contents">
              {t.to ? (
                <Link
                  to={t.to}
                  aria-label={t.label}
                  aria-current={active ? "page" : undefined}
                  onClick={tapHaptic}
                  className={cellBase}
                >
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    tapHaptic();
                    t.onClick?.();
                  }}
                  aria-label={t.label}
                  className={cellBase}
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
        <li className="contents">
          <Link
            to="/profile"
            aria-label="Profile"
            aria-current={profileActive ? "page" : undefined}
            onClick={tapHaptic}
            className={cellBase}
          >
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute left-1/2 top-1 h-1 w-6 -translate-x-1/2 rounded-full bg-foreground transition-all duration-300 ease-out",
                profileActive ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0",
              )}
            />
            <span
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-widest transition-colors duration-200",
                profileActive ? "text-foreground" : "text-foreground/55",
              )}
            >
              <UserAvatar
                src={avatarUrl}
                name={displayName}
                size="sm"
                className={cn(
                  "transition-all duration-200 ease-out",
                  profileActive
                    ? "scale-110 ring-2 ring-foreground"
                    : "ring-1 ring-hairline",
                )}
              />
              <span className="sr-only">Profile</span>
            </span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}

function MobileNavBarImpl({ onCreate }: { onCreate?: () => void }) {
  const [open, setOpen] = useState(false);
  const { data: me } = useSuspenseQuery(meQ);
  const userMeta = me?.userMetadata as Record<string, string> | null;
  const name = me?.profile?.display_name || me?.profile?.full_name || userMeta?.full_name || userMeta?.name || "You";
  const avatarUrl =
    (me?.profile?.avatar_url as string | null) ||
    (me?.profile?.avatar_urls as { sm?: string; md?: string; lg?: string } | null)?.sm ||
    (me?.profile?.avatar_urls as { sm?: string; md?: string; lg?: string } | null)?.md ||
    userMeta?.avatar_url ||
    userMeta?.picture ||
    null;
  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  // Swipe-to-close state (drag left to dismiss)
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const dragState = React.useRef<{
    id: number;
    startX: number;
    startY: number;
    startTime: number;
    dx: number;
    active: boolean;
    horizontal: boolean | null;
  } | null>(null);

  const applyTransform = React.useCallback((dx: number, withTransition: boolean) => {
    const el = contentRef.current;
    if (!el) return;
    el.style.transition = withTransition
      ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out"
      : "none";
    el.style.transform = dx === 0 ? "" : `translate3d(${dx}px, 0, 0)`;
    // Fade overlay-adjacent content slightly as it slides away
    const width = el.offsetWidth || 320;
    const progress = Math.min(1, Math.max(0, -dx / width));
    el.style.opacity = String(1 - progress * 0.25);
  }, []);

  const resetTransform = React.useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    el.style.transition = "";
    el.style.transform = "";
    el.style.opacity = "";
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore drags that start on interactive controls (buttons/links/inputs)
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, [role='slider'], [data-no-swipe]")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragState.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTime: performance.now(),
      dx: 0,
      active: true,
      horizontal: null,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragState.current;
    if (!s || !s.active || s.id !== e.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (s.horizontal === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      s.horizontal = Math.abs(dx) > Math.abs(dy);
      if (!s.horizontal) {
        s.active = false;
        return;
      }
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* noop */ }
    }
    // Only allow leftward drag (dismiss direction); tiny rightward rubber-band
    const clamped = dx > 0 ? Math.min(dx * 0.25, 24) : dx;
    s.dx = clamped;
    applyTransform(clamped, false);
  };

  const finishSwipe = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragState.current;
    if (!s || s.id !== e.pointerId) return;
    dragState.current = null;
    if (!s.horizontal) return;
    const el = contentRef.current;
    const width = el?.offsetWidth || 320;
    const elapsed = performance.now() - s.startTime;
    const velocity = s.dx / Math.max(1, elapsed); // px/ms, negative = left
    const shouldClose = s.dx < -width * 0.33 || velocity < -0.6;
    if (shouldClose && el) {
      // Animate out then let Radix unmount
      el.style.transition = "transform 200ms cubic-bezier(0.4, 0, 1, 1), opacity 200ms ease-in";
      el.style.transform = `translate3d(${-width}px, 0, 0)`;
      el.style.opacity = "0";
      window.setTimeout(() => {
        setOpen(false);
        // Radix will unmount; clear inline styles on next open
        window.setTimeout(resetTransform, 50);
      }, 190);
    } else {
      applyTransform(0, true);
      window.setTimeout(resetTransform, 240);
    }
  };

  return (
    <nav aria-label="Mobile" className="flex items-center justify-between gap-3 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-controls="mobile-nav-sheet"
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 pr-4 text-sm font-bold backdrop-blur transition hover:border-primary/40",
              focusRing,
            )}
          >
            <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
              <Menu className="h-4 w-4" />
            </span>
            <span className="truncate">Menu</span>
          </button>
        </SheetTrigger>
        <SheetContent
          ref={contentRef}
          id="mobile-nav-sheet"
          side="left"
          aria-label="Primary navigation"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishSwipe}
          onPointerCancel={finishSwipe}
          onOpenAutoFocus={(e) => {
            // Let Radix trap focus; move initial focus to the first nav link for polish.
            const el = contentRef.current;
            const first = el?.querySelector<HTMLElement>(
              "a[href], button:not([aria-label='Close'])",
            );
            if (first) {
              e.preventDefault();
              first.focus({ preventScroll: true });
            }
          }}
          className="w-[86vw] max-w-[340px] touch-pan-y select-none overflow-y-auto border-r border-border/60 bg-background/95 p-4 backdrop-blur-xl will-change-transform data-[state=closed]:duration-200 data-[state=open]:duration-300 data-[state=closed]:ease-[cubic-bezier(0.4,0,1,1)] data-[state=open]:ease-[cubic-bezier(0.22,1,0.36,1)]"
        >
          <VisuallyHidden>
            <SheetTitle>Navigation</SheetTitle>
          </VisuallyHidden>
          {open && (
            <LeftSidebar
              variant="full"
              onNavigate={() => setOpen(false)}
              onCreate={onCreate}
            />
          )}
        </SheetContent>
      </Sheet>

      <Link
        to="/profile"
        className={cn(
          "flex items-center gap-2 rounded-full border border-border/60 bg-card/60 py-1 pl-1 pr-3 backdrop-blur",
          focusRing,
        )}
        aria-label={`Open ${name} profile`}
      >
        <UserAvatar
          src={avatarUrl}
          name={name}
          size="sm"
          isTrainer={me?.isTrainer}
        />
        <span className="max-w-[110px] truncate text-xs font-bold">{name}</span>
      </Link>
    </nav>
  );
}

// -------- Stories rail --------------------------------------------------

function StoriesRail() {
  const { data: me } = useSuspenseQuery(meQ);
  const { data: reelsData } = useSuspenseQuery(storiesQ);
  const qc = useQueryClient();
  const recordView = useServerFn(recordStoryView);
  const removeStory = useServerFn(deleteStory);
  const userMeta = me?.userMetadata as Record<string, string> | null;
  const myName = me?.profile?.display_name || me?.profile?.full_name || userMeta?.full_name || userMeta?.name || "You";
  const myAvatarUrl =
    (me?.profile?.avatar_url as string | null) ||
    (me?.profile?.avatar_urls as { sm?: string; md?: string; lg?: string } | null)?.lg ||
    (me?.profile?.avatar_urls as { sm?: string; md?: string; lg?: string } | null)?.md ||
    (me?.profile?.avatar_urls as { sm?: string; md?: string; lg?: string } | null)?.sm ||
    userMeta?.avatar_url ||
    userMeta?.picture ||
    null;
  const myId = me?.userId ?? null;
  const [composerOpen, setComposerOpen] = useState(false);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const deepStoryId = search.story ?? null;

  const reels: StoryReel[] = useMemo(
    () =>
      reelsData.map((r: ActiveStoryReel) => ({
        person: {
          user_id: r.user_id,
          name: r.display_name || r.username || (r.is_self ? myName : "Creator"),
          handle: r.username,
          avatar_url: r.avatar_url,
          cover_url: null,
          is_verified: r.is_verified,
        },
        slides: r.slides.map((s) => ({
          id: s.id,
          url: s.media_url,
          kind: s.media_kind,
          createdAtLabel: relativeTime(s.created_at),
        })),
      })),
    [reelsData, myName],
  );
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [deepSlideId, setDeepSlideId] = useState<string | null>(null);

  // Deep-link: open the reel containing ?story=<id> at that exact slide.
  useEffect(() => {
    if (!deepStoryId) return;
    const idx = reels.findIndex((r) => r.slides.some((s) => s.id === deepStoryId));
    if (idx >= 0) {
      setOpenIdx(idx);
      setDeepSlideId(deepStoryId);
      // Clear the param so a manual close doesn't reopen it.
      navigate({ search: { story: undefined }, replace: true }).catch(() => {});
    }
  }, [deepStoryId, reels, navigate]);

  const openReelFor = useCallback(
    (userId: string) => {
      const i = reels.findIndex((r) => r.person.user_id === userId);
      if (i >= 0) setOpenIdx(i);
    },
    [reels],
  );

  // Record view when a slide is shown (optimistically update cache to avoid mid-playback query refetches)
  const onSlideView = useCallback(
    (storyId: string) => {
      recordView({ data: { story_id: storyId } })
        .then(() => {
          qc.setQueryData<ActiveStoryReel[]>(["stories", "active"], (old) => {
            if (!old) return old;
            return old.map((reel) => ({
              ...reel,
              slides: reel.slides.map((s) => (s.id === storyId ? { ...s, viewed: true } : s)),
              all_viewed: reel.slides.every((s) => (s.id === storyId ? true : s.viewed)),
            }));
          });
        })
        .catch(() => {});
    },
    [recordView, qc],
  );

  const onDeleteSlide = useCallback(
    async (storyId: string) => {
      try {
        await removeStory({ data: { id: storyId } });
        toast.success("Story deleted");
        qc.invalidateQueries({ queryKey: ["stories", "active"] });
      } catch (e) {
        toast.error((e as Error).message || "Could not delete story");
      }
    },
    [removeStory, qc],
  );

  const myReel = reels.find((r) => r.person.user_id === myId);
  const others = reels.filter((r) => r.person.user_id !== myId);

  return (
    <section aria-label="Stories">
      <ScrollRail ariaLabel="Stories" className="gap-4">
        {/* Your story tile — opens composer or your own reel */}
        <StoryTile
          name={myName.split(" ")[0] || "You"}
          avatar={myAvatarUrl}
          isSelf
          hasStory={!!myReel}
          likeCount={myReel ? reelsData.find((x) => x.user_id === myId)?.total_likes ?? 0 : 0}
          onOpen={() => {
            if (myReel) openReelFor(myReel.person.user_id);
          }}
          onAdd={() => setComposerOpen(true)}
        />
        {others.map((r) => (
          <StoryTile
            key={r.person.user_id}
            name={r.person.name}
            avatar={r.person.avatar_url}
            verified={!!r.person.is_verified}
            seen={reelsData.find((x) => x.user_id === r.person.user_id)?.all_viewed}
            likeCount={reelsData.find((x) => x.user_id === r.person.user_id)?.total_likes ?? 0}
            onOpen={() => openReelFor(r.person.user_id)}
          />
        ))}
      </ScrollRail>

      <StoryViewer
        open={openIdx !== null}
        onOpenChange={(o) => {
          if (!o) {
            setOpenIdx(null);
            setDeepSlideId(null);
            qc.invalidateQueries({ queryKey: ["stories", "active"] });
          }
        }}
        reels={reels}
        index={openIdx ?? 0}
        onIndexChange={(i) => {
          setOpenIdx(i);
          setDeepSlideId(null);
        }}
        initialSlideId={deepSlideId}
        onSlideView={onSlideView}
        canDeleteSlide={(slideId) =>
          !!myReel && myReel.slides.some((s) => s.id === slideId)
        }
        onDeleteSlide={onDeleteSlide}
      />

      <StoryComposerDialog
        open={composerOpen}
        onOpenChange={setComposerOpen}
        userId={myId}
      />
    </section>
  );
}

function StoryTile({
  name,
  avatar,
  onOpen,
  onAdd,
  isSelf = false,
  verified = false,
  hasStory = false,
  seen = false,
  likeCount = 0,
  live = false,
}: {
  name: string;
  avatar: string | null;
  onOpen?: () => void;
  onAdd?: () => void;
  isSelf?: boolean;
  verified?: boolean;
  hasStory?: boolean;
  seen?: boolean;
  likeCount?: number;
  live?: boolean;
}) {
  const isYourEmpty = isSelf && !hasStory;

  // Ring wrapper: dashed for empty-self, animated gradient for live,
  // solid gradient for unseen, quiet border for seen.
  const ringClass = isYourEmpty
    ? "border-2 border-dashed border-border p-1.5 transition-all duration-300 group-hover:border-foreground group-hover:bg-muted"
    : live
    ? "bg-gradient-to-tr from-primary via-foreground to-primary p-[3px] transition-all duration-500 group-hover:rotate-6 group-hover:scale-105"
    : seen
    ? "border-2 border-border/60 p-1.5 transition-all duration-300 group-hover:border-border"
    : "bg-gradient-to-b from-primary to-muted p-[3px] transition-all duration-300 group-hover:p-1";

  const innerImgClass = seen && !live && !isYourEmpty
    ? "h-full w-full overflow-hidden rounded-full opacity-50 grayscale transition-all duration-300 group-hover:opacity-100 group-hover:grayscale-0"
    : isYourEmpty
    ? "h-full w-full overflow-hidden rounded-full opacity-70 transition-opacity group-hover:opacity-100"
    : "h-full w-full overflow-hidden rounded-full";

  const labelClass = live
    ? "text-primary"
    : seen
    ? "text-foreground/30 group-hover:text-foreground/60"
    : isYourEmpty
    ? "text-foreground/40 group-hover:text-foreground"
    : "text-foreground/80 group-hover:text-foreground";

  return (
    <button
      type="button"
      className="group relative flex shrink-0 snap-start flex-col items-center gap-3 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      onClick={() => {
        if (isYourEmpty) onAdd?.();
        else onOpen?.();
      }}
      aria-label={
        isSelf
          ? hasStory
            ? "View your story"
            : "Add to your story"
          : `Open ${name}'s story`
      }
    >
      <span className="relative block">
        {/* Live orbit pulses */}
        {live && (
          <>
            <span className="pointer-events-none absolute -inset-2 animate-pulse rounded-full border border-primary/20" />
            <span className="pointer-events-none absolute -inset-1 animate-pulse rounded-full border border-primary/40 [animation-delay:150ms]" />
          </>
        )}

        <span className={`relative block h-20 w-20 rounded-full ${ringClass}`}>
          <span
            className={`grid h-full w-full place-items-center rounded-full bg-background ${
              isYourEmpty ? "" : "p-1"
            }`}
          >
            <span className={innerImgClass}>
              <UserAvatar
                src={avatar}
                name={name}
                size="full"
                className="h-full w-full rounded-full"
              />
            </span>
          </span>
        </span>

        {/* Your-story add badge — chrome white disc with rotating plus */}
        {isSelf && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onAdd?.();
            }}
            role="button"
            aria-label="Add to your story"
            className="absolute -bottom-1 -right-1 z-10 grid h-7 w-7 place-items-center rounded-full border-[3px] border-background bg-foreground text-background shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-90"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        )}

        {/* Verified corner mark */}
        {verified && !isSelf && !live && (
          <span className="absolute -bottom-1 -right-1 z-10 grid h-5 w-5 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground">
            <BadgeCheck className="h-3 w-3" />
          </span>
        )}

        {/* LIVE pill */}
        {live && (
          <span className="absolute -bottom-2.5 left-1/2 z-10 -translate-x-1/2 rounded-[3px] bg-primary px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter text-primary-foreground shadow-[0_4px_12px_hsl(var(--primary)/0.35)]">
            Live
          </span>
        )}

        {/* Likes floating chip */}
        {likeCount > 0 && !live && (
          <span
            className="absolute -top-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-background bg-background/95 px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm"
            aria-label={`${likeCount} likes`}
          >
            <Heart className="h-2.5 w-2.5 fill-red-500 text-red-500" />
            {formatShort(likeCount)}
          </span>
        )}
      </span>

      <span
        className={`line-clamp-1 max-w-[88px] text-center text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${labelClass}`}
      >
        {isSelf ? "Your story" : name}
      </span>
    </button>
  );
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diffMs = Date.now() - t;
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatShort(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (n < 1_000_000) return `${Math.floor(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

// -------- Reels rail ----------------------------------------------------

function ReelsRail() {
  const { data: reels } = useSuspenseQuery(reelsQ);
  const list = reels.slice(0, 8);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const items: ReelItem[] = useMemo(
    () =>
      list.map((r) => ({
        id: r.id,
        media_url: r.media_url,
        thumbnail_url: r.thumbnail_url,
        respect_count: r.respect_count,
        comment_count: r.comment_count,
        trainer: {
          user_id: r.trainer.user_id,
          username: r.trainer.username,
          display_name: r.trainer.display_name,
          avatar_url: r.trainer.avatar_url,
        },
      })),
    [list],
  );

  return (
    <section aria-labelledby="reels-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2
          id="reels-heading"
          className="font-display text-lg font-black uppercase tracking-tight"
        >
          Reels
        </h2>
        <Link
          to="/feed"
          className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-primary hover:underline"
        >
          See all <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<Film className="h-6 w-6" />}
          title="No reels yet"
          hint="Check back soon or follow creators to see shorts here."
        />
      ) : (
        <ScrollRail ariaLabel="Reels" className="gap-3">
          {list.map((r, i) => {
            const poster = r.thumbnail_url;
            // Deterministic random seek (1s–6s) per reel so posters look varied
            // but stable across renders.
            const seed = Array.from(r.id).reduce(
              (acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0,
              7,
            );
            const seekAt = 1 + (seed % 6);
            const displayName =
              r.trainer.display_name || r.trainer.username || "Creator";
            const handle = r.trainer.username ? `@${r.trainer.username}` : "";
            return (
              <button
                type="button"
                key={r.id}
                onClick={() => setOpenIdx(i)}
                className="group snap-start text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
                aria-label={`Play reel by ${displayName}`}
              >
                <div className="relative aspect-[9/16] w-[160px] shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted sm:w-[180px]">
                  {poster ? (
                    <SmartImage
                      src={poster}
                      widths={[180, 360, 480]}
                      sizes="180px"
                      targetWidth={360}
                      fit="cover"
                      className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    // No stored thumbnail — grab a random frame from the video
                    // itself using the media-fragment `#t=` seek hint. Browsers
                    // render the seeked frame as the poster while `preload="metadata"`.
                    <video
                      src={`${r.media_url}#t=${seekAt}`}
                      preload="metadata"
                      muted
                      playsInline
                      disablePictureInPicture
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  {/* Gradient scrim */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />
                  {/* Play icon */}
                  <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur">
                      <Play className="ml-0.5 h-5 w-5 fill-current" />
                    </span>
                  </div>
                  {/* Stats */}
                  <div className="absolute bottom-2 left-2 flex items-center gap-2 text-[11px] font-bold text-white/95 drop-shadow">
                    <span className="inline-flex items-center gap-1">
                      <Play className="h-3 w-3 fill-current" />
                      {r.view_count}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {r.respect_count}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5 px-1">
                  <UserAvatar
                    src={r.trainer.avatar_url}
                    name={displayName}
                    size="sm"
                    className="h-5 w-5"
                  />
                  <span className="truncate text-[11px] font-semibold text-foreground/80">
                    {handle || displayName}
                  </span>
                </div>
              </button>
            );
          })}
        </ScrollRail>
      )}

      <ReelPlayer
        open={openIdx !== null}
        onOpenChange={(o) => !o && setOpenIdx(null)}
        reels={items}
        index={openIdx ?? 0}
        onIndexChange={setOpenIdx}
      />
    </section>
  );
}

// -------- 3-column feed grid --------------------------------------------

function FeedGrid() {
  const { data: posts } = useSuspenseQuery(feedQ);
  const qc = useQueryClient();

  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) =>
      setUserId(s?.user?.id ?? null),
    );
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  const signedIn = !!userId;

  const postIds = useMemo(() => posts.map((p) => p.id), [posts]);

  const viewerEngFn = useServerFn(getViewerEngagementBatch);
  const { data: viewerEng } = useQuery({
    queryKey: ["home", "viewer-engagement", userId, postIds.length],
    queryFn: () => viewerEngFn({ data: { postIds } }),
    enabled: signedIn && postIds.length > 0,
    staleTime: 30_000,
  });
  const likedSet = useMemo(() => new Set(viewerEng?.liked ?? []), [viewerEng]);
  const savedSet = useMemo(() => new Set(viewerEng?.saved ?? []), [viewerEng]);

  // Realtime: reflect count changes on visible posts.
  const visibleRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    visibleRef.current = new Set(postIds);
  }, [postIds]);
  useEffect(() => {
    if (postIds.length === 0) return;
    const channel = supabase
      .channel("home-feed-stream")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts" },
        (payload) => {
          const row = payload.new as {
            id?: string;
            respect_count?: number;
            save_count?: number;
            comment_count?: number;
            view_count?: number;
          } | null;
          if (!row?.id || !visibleRef.current.has(row.id)) return;
          qc.setQueryData<FeedItem[]>(["home", "discovery-feed"], (old) =>
            old
              ? old.map((p) =>
                  p.id === row.id
                    ? {
                        ...p,
                        respect_count: row.respect_count ?? p.respect_count,
                        save_count: row.save_count ?? p.save_count,
                        comment_count: row.comment_count ?? p.comment_count,
                        view_count: row.view_count ?? p.view_count,
                      }
                    : p,
                )
              : old,
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, postIds.length]);

  const [openId, setOpenId] = useState<string | null>(null);
  const [panel, setPanel] = useState<"media" | "comments">("media");
  const [commentSort, setCommentSort] = useState<"newest" | "oldest">("newest");

  const [density, setDensity] = useState<"compact" | "comfortable">(() => {
    if (typeof window === "undefined") return "comfortable";
    return (localStorage.getItem("home:feed-density") as "compact" | "comfortable") || "comfortable";
  });
  useEffect(() => {
    try {
      localStorage.setItem("home:feed-density", density);
    } catch {}
  }, [density]);

  const openPost = useCallback((id: string, p: "media" | "comments" = "media") => {
    setPanel(p);
    setOpenId(id);
  }, []);

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={<Compass className="h-6 w-6" />}
        title="Your feed is quiet"
        hint="Follow a few creators from Explore to fill this up."
        cta={
          <Link
            to="/explore"
            className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-xs font-black uppercase tracking-widest text-primary-foreground"
          >
            Explore creators
          </Link>
        }
      />
    );
  }

  return (
    <section aria-labelledby="feed-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2
          id="feed-heading"
          className="font-display text-lg font-black uppercase tracking-tight"
        >
          For you
        </h2>
        <div className="flex items-center gap-3">
          <div
            role="group"
            aria-label="Card size"
            className="inline-flex items-center rounded-full border border-border/60 bg-card/60 p-0.5 backdrop-blur"
          >
            {(["comfortable", "compact"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDensity(d)}
                aria-pressed={density === d}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors",
                  density === d
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {d === "comfortable" ? "Comfy" : "Compact"}
              </button>
            ))}
          </div>
          <span className="hidden text-[10px] font-black uppercase tracking-widest text-muted-foreground sm:inline">
            {posts.length} posts
          </span>
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-1",
          density === "compact"
            ? "gap-2 min-[380px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5"
            : "gap-3 min-[380px]:grid-cols-2 sm:grid-cols-3",
        )}
      >
        {posts.map((p) => (
          <PostTile
            key={p.id}
            post={p}
            liked={likedSet.has(p.id)}
            saved={savedSet.has(p.id)}
            signedIn={signedIn}
            density={density}
            onOpen={(pn) => openPost(p.id, pn)}
          />
        ))}
      </div>

      {openId ? (
        (() => {
          const post = posts.find((x) => x.id === openId);
          if (!post) return null;
          return (
            <PostDetailDialog
              post={post}
              open={!!openId}
              onOpenChange={(o) => !o && setOpenId(null)}
              currentUserId={userId}
              isSignedIn={signedIn}
              panel={panel}
              onPanelChange={setPanel}
              commentSort={commentSort}
              onCommentSortChange={setCommentSort}
            />
          );
        })()
      ) : null}
    </section>
  );
}

function PostTile({
  post,
  liked,
  saved,
  signedIn,
  density = "comfortable",
  onOpen,
}: {
  post: FeedItem;
  liked: boolean;
  saved: boolean;
  signedIn: boolean;
  density?: "compact" | "comfortable";
  onOpen: (panel: "media" | "comments") => void;
}) {
  const src = post.thumbnail_url || post.media_url;
  const isShort = post.kind === "short";
  const displayName = post.trainer.display_name || post.trainer.username || "Creator";
  const qc = useQueryClient();
  const respectFn = useServerFn(toggleRespect);
  const saveFn = useServerFn(toggleSave);
  const shareFn = useServerFn(logShare);

  const [optLiked, setOptLiked] = useState(liked);
  const [optSaved, setOptSaved] = useState(saved);
  useEffect(() => setOptLiked(liked), [liked]);
  useEffect(() => setOptSaved(saved), [saved]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shared, setShared] = useState(false);

  const bumpCount = useCallback(
    (field: "respect_count" | "save_count", delta: number) => {
      qc.setQueryData<FeedItem[]>(["home", "discovery-feed"], (old) =>
        old
          ? old.map((p) =>
              p.id === post.id
                ? { ...p, [field]: Math.max(0, (p[field] ?? 0) + delta) }
                : p,
            )
          : old,
      );
    },
    [qc, post.id],
  );

  const likeMut = useMutation({
    mutationFn: () => respectFn({ data: { postId: post.id } }),
    onMutate: () => {
      const next = !optLiked;
      setOptLiked(next);
      bumpCount("respect_count", next ? +1 : -1);
      return { next };
    },
    onError: (err: Error, _v, ctx) => {
      setOptLiked((v) => !v);
      if (ctx) bumpCount("respect_count", ctx.next ? -1 : +1);
      toast.error(
        err.message.includes("Unauthorized") ? "Sign in to like" : "Couldn't update like",
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["discovery-feed"] });
      qc.invalidateQueries({ queryKey: ["shorts-feed"] });
      qc.invalidateQueries({ queryKey: ["explore-feed"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { postId: post.id } }),
    onMutate: () => {
      const next = !optSaved;
      setOptSaved(next);
      bumpCount("save_count", next ? +1 : -1);
      return { next };
    },
    onError: (err: Error, _v, ctx) => {
      setOptSaved((v) => !v);
      if (ctx) bumpCount("save_count", ctx.next ? -1 : +1);
      toast.error(
        err.message.includes("Unauthorized") ? "Sign in to save" : "Couldn't save",
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["discovery-feed"] });
      qc.invalidateQueries({ queryKey: ["shorts-feed"] });
      qc.invalidateQueries({ queryKey: ["explore-feed"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const [burst, setBurst] = useState<{ x: number; y: number; id: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const doubleTapLike = (x?: number, y?: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const cx = rect && typeof x === "number" ? x - rect.left : (rect?.width ?? 0) / 2;
    const cy = rect && typeof y === "number" ? y - rect.top : (rect?.height ?? 0) / 2;
    const id = Date.now();
    setBurst({ x: cx, y: cy, id });
    setTimeout(() => {
      setBurst((b) => (b && b.id === id ? null : b));
    }, 950);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([12, 40, 18]);
      } catch {}
    }
    if (!signedIn) {
      toast.error("Sign in to like");
      return;
    }
    if (!optLiked && !likeMut.isPending) likeMut.mutate();
  };

  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMediaClick = (e: React.MouseEvent) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      doubleTapLike(e.clientX, e.clientY);
    } else {
      const x = e.clientX;
      const y = e.clientY;
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        onOpen("media");
      }, 250);
    }
  };

  const requireAuth = (label: string) => {
    if (!signedIn) {
      toast.error(`Sign in to ${label}`);
      return false;
    }
    return true;
  };

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/trainers/${post.trainer.username ?? post.trainer.user_id}`
      : `/trainers/${post.trainer.username ?? post.trainer.user_id}`;

  return (
    <div ref={containerRef} className="group relative overflow-hidden rounded-xl border border-border/60 bg-muted">
      <button
        type="button"
        onClick={handleMediaClick}
        aria-label={`Open post by ${displayName}`}
        className="block w-full text-left cursor-pointer"
      >
        <div className="relative aspect-square w-full">
        {burst && (
          <div
            className="pointer-events-none absolute z-30 grid -translate-x-1/2 -translate-y-1/2 place-items-center"
            style={{ left: burst.x, top: burst.y }}
          >
            <div className="absolute h-20 w-20 animate-heart-ring rounded-full border-2 border-premium/80" />
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className="absolute h-1.5 w-1.5 animate-heart-spark rounded-full bg-premium shadow-[0_0_8px_var(--premium)]"
                style={{
                  transform: `rotate(${i * 60}deg) translateY(-32px)`,
                  animationDelay: `${i * 25}ms`,
                }}
              />
            ))}
            <Heart className="h-16 w-16 animate-heart-burst fill-premium text-premium filter drop-shadow-[0_4px_16px_rgba(239,68,68,0.7)]" />
          </div>
        )}
        <SmartImage
          src={src}
          widths={[240, 360, 480, 640]}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px"
          targetWidth={480}
          fit="cover"
          className={cn(
            "absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-105",
            post.is_premium && !src && "locked-blur opacity-60",
          )}
        />
        {isShort && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur">
            <Film className="h-3 w-3" /> Reel
          </span>
        )}
        {post.is_premium && !src ? (
          <>
            {/* Dark scrim so the lock reads clearly over any image */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-black/75" />
            {/* Centered lock badge */}
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="flex flex-col items-center gap-2">
                <span
                  className="relative grid h-12 w-12 place-items-center rounded-full backdrop-blur-md ring-2"
                  style={{
                    backgroundColor: "color-mix(in oklch, var(--premium) 22%, transparent)",
                    color: "var(--premium-foreground)",
                    boxShadow:
                      "0 0 0 1px color-mix(in oklch, var(--premium) 60%, transparent), 0 10px 30px -8px color-mix(in oklch, var(--premium) 55%, transparent)",
                  }}
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 animate-ping rounded-full opacity-40"
                    style={{
                      backgroundColor:
                        "color-mix(in oklch, var(--premium) 35%, transparent)",
                    }}
                  />
                  <Lock className="relative h-5 w-5" />
                </span>
                <span className="rounded-full bg-black/55 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-white backdrop-blur">
                  Premium
                </span>
              </div>
            </div>
          </>
        ) : post.is_premium ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary backdrop-blur">
            <Sparkles className="h-3 w-3" /> Premium
          </span>
        ) : null}
        {/* Bottom overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2">
          <div className="flex items-center gap-1.5">
            <UserAvatar
              src={post.trainer.avatar_url}
              name={displayName}
              size="sm"
              className="h-5 w-5"
            />
            <span className="truncate text-[11px] font-semibold text-white">
              {displayName}
            </span>
            {post.trainer.is_verified && (
              <BadgeCheck className="h-3 w-3 shrink-0 text-primary" />
            )}
          </div>
        </div>
        </div>
      </button>

      {/* Action bar */}
      {density === "compact" ? null : (
      <div className="flex items-center justify-between gap-1 border-t border-border/60 bg-background/95 px-2 py-1.5">
        <div className="flex items-center gap-0.5">
          <ActionBtn
            label={optLiked ? "Unlike" : "Like"}
            active={optLiked}
            onClick={() => {
              if (!requireAuth("like")) return;
              if (!likeMut.isPending) likeMut.mutate();
            }}
          >
            <Heart
              className={cn(
                "h-4 w-4 transition-transform",
                optLiked && "scale-110 fill-current text-primary",
              )}
            />
            <span className="tabular-nums">{post.respect_count}</span>
          </ActionBtn>
          <ActionBtn
            label="Comment"
            onClick={() => onOpen("comments")}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="tabular-nums">{post.comment_count}</span>
          </ActionBtn>
          <ActionBtn
            label="Share"
            active={shared}
            onClick={() => setShareOpen(true)}
          >
            {shared ? <Check className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
          </ActionBtn>
        </div>
        <ActionBtn
          label={optSaved ? "Unsave" : "Save"}
          active={optSaved}
          onClick={() => {
            if (!requireAuth("save")) return;
            if (!saveMut.isPending) saveMut.mutate();
          }}
        >
          <Bookmark
            className={cn(
              "h-4 w-4 transition-transform",
              optSaved && "scale-110 fill-current text-primary",
            )}
          />
        </ActionBtn>
      </div>
      )}

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={shareUrl}
        title={post.caption ?? `Check this post by ${displayName} on LEER`}
        onShared={(channel) => {
          shareFn({ data: { postId: post.id, channel } }).catch(() => {});
          setShared(true);
          setTimeout(() => setShared(false), 1600);
        }}
      />
    </div>
  );
}

function ActionBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "text-primary",
      )}
    >
      {children}
    </button>
  );
}

// -------- Right sidebar -------------------------------------------------

function RightSidebar() {
  const [q, setQ] = useState("");
  const { data: creators } = useSuspenseQuery(spotlightQ);
  const [seed, setSeed] = useState(0);
  const suggestions = useMemo(() => {
    const shuffled = [...creators];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = (i * 9301 + 49297 + seed * 233) % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 3);
  }, [creators, seed]);

  return (
    <>
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="relative"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-10 rounded-full pl-9"
          aria-label="Search LEER"
        />
      </form>

      <SidebarCard
        title="Suggestions"
        actions={
          <button
            type="button"
            onClick={() => setSeed((s) => s + 1)}
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Refresh suggestions"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        }
      >
        <ul className="space-y-3">
          {suggestions.map((c) => (
            <li key={c.user_id}>
              <SuggestionCard creator={c} />
            </li>
          ))}
          {suggestions.length === 0 && (
            <li className="text-xs text-muted-foreground">
              No suggestions right now.
            </li>
          )}
        </ul>
      </SidebarCard>

      <SidebarCard title="Popular tags">
        <div className="flex flex-wrap gap-2">
          {["travel", "art", "backpack", "blog", "photographer", "test", "nature"].map(
            (t) => (
              <Link
                key={t}
                to="/explore"
                className="inline-flex items-center rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] font-bold text-foreground/80 transition hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
              >
                #{t}
              </Link>
            ),
          )}
        </div>
      </SidebarCard>

      <nav
        aria-label="Footer"
        className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground"
      >
        <Link to="/" className="hover:text-foreground">Help</Link>
        <span>·</span>
        <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
        <span>·</span>
        <Link to="/terms" className="hover:text-foreground">Terms</Link>
      </nav>
    </>
  );
}

function SuggestionCard({
  creator,
}: {
  creator: Awaited<ReturnType<typeof getSpotlightTrainers>>[number];
}) {
  return _SuggestionCardImpl({ creator });
}

function RightRail() {
  const { data: creators } = useSuspenseQuery(spotlightQ);
  const items = creators.slice(0, 8);
  return (
    <nav
      aria-label="Suggestions"
      className="flex flex-col items-center gap-3 rounded-3xl border border-border/50 bg-card/40 p-2 backdrop-blur"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to="/explore"
            aria-label="Search"
            className="grid h-11 w-11 place-items-center rounded-2xl text-foreground/75 transition hover:bg-muted/60 hover:text-foreground"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="left">Search</TooltipContent>
      </Tooltip>
      <div aria-hidden="true" className="mx-auto h-px w-8 bg-border/60" />
      <ul className="flex w-full flex-col items-center gap-2">
        {items.map((c) => {
          const name = c.display_name || c.username || "Creator";
          return (
            <li key={c.user_id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={c.username ? "/trainers/$username" : "/explore"}
                    params={c.username ? { username: c.username } : undefined}
                    aria-label={`Open ${name}'s profile`}
                    className="grid h-10 w-10 place-items-center rounded-full ring-2 ring-transparent transition hover:ring-primary/50"
                  >
                    <UserAvatar src={c.avatar_url} name={name} size="sm" isTrainer />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="left">{name}</TooltipContent>
              </Tooltip>
            </li>
          );
        })}
        {items.length === 0 && (
          <li className="px-1 text-center text-[10px] text-muted-foreground">No picks</li>
        )}
      </ul>
    </nav>
  );
}

function _SuggestionCardImpl({
  creator,
}: {
  creator: Awaited<ReturnType<typeof getSpotlightTrainers>>[number];
}) {
  const displayName = creator.display_name || creator.username || "Creator";
  const handle = creator.username ? `@${creator.username}` : "";

  return (
    <Link
      to={creator.username ? "/trainers/$username" : "/explore"}
      params={creator.username ? { username: creator.username } : undefined}
      className="group relative block overflow-hidden rounded-xl border border-border/60 bg-card"
      aria-label={`Open ${displayName}'s profile`}
    >
      <div className="relative aspect-[16/9] w-full bg-muted">
        {creator.cover_url ? (
          <SmartImage
            src={creator.cover_url}
            widths={[320, 480, 640]}
            sizes="320px"
            targetWidth={480}
            fit="cover"
            className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-background to-muted" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        {/* Avatar overlay */}
        <div className="absolute -bottom-6 left-3 z-10 flex items-end gap-2">
          <span className="inline-flex rounded-full bg-gradient-to-tr from-primary to-primary/40 p-[2px] shadow-lg">
            <UserAvatar
              src={creator.avatar_url}
              name={displayName}
              size="lg"
              className="h-12 w-12 overflow-hidden rounded-full bg-background"
            />
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-8">
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate text-sm font-bold">
            <span className="truncate">{displayName}</span>
            {creator.is_verified && (
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">{handle}</p>
        </div>
      </div>
    </Link>
  );
}

// -------- Shared ---------------------------------------------------------

function SidebarCard({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-3">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
          {title}
        </h3>
        {actions}
      </header>
      {children}
    </section>
  );
}

function EmptyState({
  icon,
  title,
  hint,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 px-6 py-10 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="mt-3 font-display text-base font-black uppercase tracking-tight">
        {title}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}

// Placate the unused-import checker for optional Query hook we may use later.
void useQuery;
