import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  queryOptions,
  useMutation,
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  MapPin,
  Lock,
  Users,
  Video,
  MessageSquare,
  Loader2,
  Flag,
  CalendarDays,
  Clock,
  HelpCircle,
  Trophy,
  Dumbbell,
  ArrowRight,
  Search,
  Share2,
  UserPlus,
  UserCheck,
  UserX,
  Check,
  Sparkles,
  Heart,
  Settings,
} from "lucide-react";
import { UnlockCheckoutDialog } from "@/components/unlock-checkout-dialog";
import { TipModal } from "@/components/tip-modal";
import { CreatorMobileActionBar } from "@/components/creator-mobile-action-bar";

function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
}

function validateUsername(raw: string): { ok: boolean; reason?: string } {
  const v = raw.trim().replace(/^@+/, "");
  if (v.length === 0) return { ok: false, reason: "Username is empty." };
  if (v.length < 3) return { ok: false, reason: "Usernames must be at least 3 characters." };
  if (v.length > 30) return { ok: false, reason: "Usernames must be 30 characters or fewer." };
  if (!/^[A-Za-z0-9_]+$/.test(v))
    return { ok: false, reason: "Usernames can only contain letters, numbers, and underscores." };
  if (v !== v.toLowerCase()) return { ok: false, reason: "Usernames are lowercase." };
  return { ok: true };
}
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import {
  getTrainerByUsername,
  getFollowCounts,
  findSimilarTrainers,
  type Post,
  type TrainerCommunityPost,
  type TrainerSummary,
} from "@/lib/trainer-functions";
import { TranslateToggle } from "@/components/translate-toggle";
import { AskQuestionDialog } from "@/components/ask-question-dialog";
import {
  cancelSubscription,
  getPremiumPostUrls,
  getSubscriptionInfo,
  toggleFollow,
  type SubscriptionInfo,
} from "@/lib/subscription-functions";
import { supabase } from "@/integrations/supabase/client";
import { PostTile } from "@/components/post-tile";
import { PostDetailDialog } from "@/components/post-detail-dialog";
import { ReportDialog } from "@/components/report-dialog";
import { ComposeCommunityDialog } from "@/routes/community";
import { FollowListDialog, type FollowListKind } from "@/components/follow-list-dialog";
import { TabPanel, TabGridSkeleton } from "@/components/tab-panel";
import {
  applyOptimisticFollow,
  rollbackOptimisticFollow,
  reconcileFollowFromServer,
  invalidateFollow,
  bumpViewerFollowingCache,
  type FollowMutationContext,
  applyOptimisticSubscribe,
  rollbackOptimisticSubscribe,
  type SubscribeMutationContext,
} from "@/lib/follow-optimistic";

function ReportButton({ trainerId }: { trainerId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="default"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="group rounded-xl border border-transparent px-3 text-xs uppercase tracking-wider text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
        title="Report profile"
      >
        <Flag className="mr-1.5 h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />
        Report
      </Button>
      <ReportDialog
        open={open}
        onOpenChange={setOpen}
        targetType="profile"
        targetId={trainerId}
      />
    </>
  );
}

function SimilarTrainersList({ query }: { query: string }) {
  const findSimilar = useServerFn(findSimilarTrainers);
  const q = useQuery({
    queryKey: ["similar-trainers", query],
    queryFn: () => findSimilar({ data: { query } }),
    enabled: !!query,
  });
  const results = (q.data ?? []) as TrainerSummary[];
  if (q.isLoading) {
    return (
      <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Searching similar trainers…
      </div>
    );
  }
  if (results.length === 0) {
    return query.trim() ? (
      <p className="mt-8 text-sm text-muted-foreground">
        No trainers matched “{query}”. Try a different name or handle.
      </p>
    ) : null;
  }
  return (
    <section className="mt-10 w-full text-left">
      <h2 className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Matching trainers
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {results.map((t) => (
          <li key={t.user_id}>
            <Link
              to="/trainers/$username"
              params={{ username: t.username ?? "" }}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-3 transition hover:border-primary/60 hover:bg-card"
            >
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted">
                {t.avatar_url ? (
                  <img
                    src={t.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-medium text-muted-foreground">
                    {(t.display_name ?? t.username ?? "?")[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate text-sm font-semibold">
                    {t.display_name ?? t.username}
                  </span>
                  {t.is_verified && (
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  @{t.username}
                  {t.country ? ` · ${t.country}` : ""}
                </p>
                {t.specialties && t.specialties.length > 0 && (
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {t.specialties.slice(0, 3).join(" · ")}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TrainerNotFoundSearch({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [query, setQuery] = useState(initial);
  useEffect(() => {
    const id = setTimeout(() => setQuery(value.trim()), 250);
    return () => clearTimeout(id);
  }, [value]);
  return (
    <div className="mt-2 w-full max-w-md">
      <label htmlFor="trainer-search" className="sr-only">
        Search trainers
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="trainer-search"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search creators by name or handle"
          className="h-11 w-full rounded-full border border-border/60 bg-card/60 pl-10 pr-4 text-sm outline-none transition focus:border-primary/60 focus:bg-card"
          autoFocus
        />
      </div>
      <SimilarTrainersList query={query} />
    </div>
  );
}

function trainerQuery(username: string) {
  return queryOptions({
    queryKey: ["trainer", username],
    queryFn: () => getTrainerByUsername({ data: { username } }),
  });
}

export const Route = createFileRoute("/trainers/$username")({
  validateSearch: zodValidator(
    z.object({
      tab: fallback(z.string(), "feed").default("feed"),
    }),
  ),
  loader: async ({ context, params }) => {
    try {
      const data = await context.queryClient.ensureQueryData(
        trainerQuery(params.username),
      );
      if (!data) throw notFound();
      return data;
    } catch (e) {
      if (e instanceof Error && e.message === "Not Found") throw e;
      console.error("Trainer loader error:", e);
      return null;
    }
  },
  head: ({ loaderData }) => {
    const t = loaderData;
    const title = t
      ? `${t.display_name ?? t.username} — LEER Sports`
      : "Trainer — LEER Sports";
    const desc = t?.value_proposition || t?.bio || "Elite fitness trainer on LEER Sports.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        ...(t?.cover_url || t?.avatar_url
          ? [
              { property: "og:image", content: t.cover_url ?? t.avatar_url! },
              { name: "twitter:image", content: t.cover_url ?? t.avatar_url! },
            ]
          : []),
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: TrainerProfile,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    const isHtml = error.message?.includes("<html") || error.message?.includes("<!doctype");
    const cleanMsg = isHtml
      ? "Unable to connect to the server. Please check your connection."
      : error.message || "An unexpected error occurred.";
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">
          Could not load creator profile
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{cleanMsg}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button
            className="font-bold bg-primary text-primary-foreground"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Retry
          </Button>
          <Button asChild variant="outline">
            <Link to="/trainers">Browse Creators</Link>
          </Button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => {
    const { username } = Route.useParams();
    const validation = validateUsername(username);
    const normalized = normalizeUsername(username);
    const suggestion =
      normalized && normalized !== username && normalized.length >= 3
        ? normalized
        : null;
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/60 text-4xl">
          🔎
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            404 · Trainer
          </p>
          <h1 className="font-display text-3xl sm:text-4xl">
            We couldn't find <span className="text-primary">@{username}</span>
          </h1>
          <p className="text-muted-foreground">
            This trainer profile doesn't exist, was renamed, or is no longer active on LEER Sports.
          </p>
          {!validation.ok && (
            <p className="text-sm text-destructive">{validation.reason}</p>
          )}
          {suggestion && (
            <p className="text-sm text-muted-foreground">
              Did you mean{" "}
              <Link
                to="/trainers/$username"
                params={{ username: suggestion }}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                @{suggestion}
              </Link>
              ?
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link to="/trainers">Browse all creators</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/feed">Explore the platform</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/">Go home</Link>
          </Button>
        </div>
        <TrainerNotFoundSearch initial={suggestion ?? username} />
      </div>
    );
  },
});

function TrainerProfile() {
  const params = Route.useParams();
  const { data: t } = useSuspenseQuery(trainerQuery(params.username));
  if (!t) return null;
  return <TrainerProfileInner t={t} />;
}

function TrainerProfileInner({
  t,
}: {
  t: NonNullable<Awaited<ReturnType<typeof getTrainerByUsername>>>;
}) {
  const feed = t.posts.filter((p) => p.kind === "feed");
  const shorts = t.posts.filter((p) => p.kind === "short");
  const publicFeedCount = feed.filter((p) => !p.is_premium).length;
  const premiumCount = t.posts.filter((p) => p.is_premium).length;

  // PRD: Trainer must have >= 3 public posts before subscribers can subscribe
  const MIN_PUBLIC_POSTS = 3;
  const hasEnoughPublicPosts = publicFeedCount >= MIN_PUBLIC_POSTS;

  // Detect signed-in state for gated calls
  const [signedIn, setSignedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) {
        setSignedIn(!!data.user);
        setCurrentUserId(data.user?.id ?? null);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session?.user);
      setCurrentUserId(session?.user?.id ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const qc = useQueryClient();
  const getInfo = useServerFn(getSubscriptionInfo);
  const getUnlocked = useServerFn(getPremiumPostUrls);

  const infoQ = useQuery({
    queryKey: ["subscription-info", t.user_id],
    queryFn: () => getInfo({ data: { trainerId: t.user_id } }),
    enabled: signedIn,
  });
  const getCounts = useServerFn(getFollowCounts);
  const countsQ = useQuery({
    queryKey: ["follow-counts", t.user_id],
    queryFn: () => getCounts({ data: { userId: t.user_id } }),
  });
  const followers = countsQ.data?.followers ?? 0;
  const following = countsQ.data?.following ?? 0;
  const subscribers = countsQ.data?.subscribers ?? 0;
  const unlockedQ = useQuery({
    queryKey: ["premium-urls", t.user_id],
    queryFn: () => getUnlocked({ data: { trainerId: t.user_id } }),
    enabled: signedIn && (currentUserId === t.user_id || !!infoQ.data?.isSubscribed),
  });

  const info: SubscriptionInfo | undefined = infoQ.data;
  const unlocked = unlockedQ.data ?? {};

  const cancelFn = useServerFn(cancelSubscription);
  const followFn = useServerFn(toggleFollow);

  const cancelMut = useMutation({
    mutationFn: () => cancelFn({ data: { trainerId: t.user_id } }),
    onMutate: () => applyOptimisticSubscribe(qc, t.user_id, false),
    onError: (e: Error, _v, ctx: SubscribeMutationContext | undefined) => {
      rollbackOptimisticSubscribe(qc, t.user_id, ctx);
      toast.error(e.message);
    },
    onSuccess: () => {
      toast.success("Subscription cancelled");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["subscription-info", t.user_id] });
      qc.invalidateQueries({ queryKey: ["premium-urls", t.user_id] });
      qc.invalidateQueries({ queryKey: ["follow-counts", t.user_id] });
    },
  });
  const followMut = useMutation({
    scope: { id: `follow:${t.user_id}` },
    mutationFn: () => followFn({ data: { trainerId: t.user_id } }),
    onMutate: async () => {
      const ctx = await applyOptimisticFollow(qc, t.user_id, currentUserId ?? null);
      if (currentUserId && currentUserId !== t.user_id) {
        bumpViewerFollowingCache(qc, currentUserId, ctx.delta);
      }
      return ctx;
    },
    onError: (e: Error, _v, ctx: FollowMutationContext | undefined) => {
      rollbackOptimisticFollow(qc, t.user_id, ctx);
      if (ctx && currentUserId && currentUserId !== t.user_id) {
        bumpViewerFollowingCache(qc, currentUserId, -ctx.delta);
      }
      toast.error(e.message);
    },
    onSuccess: (res, _v, ctx: FollowMutationContext | undefined) => {
      reconcileFollowFromServer(qc, t.user_id, ctx, res.following, currentUserId ?? null);
      toast.success(res.following ? "Following" : "Unfollowed");
    },
    onSettled: () => invalidateFollow(qc, t.user_id, currentUserId ?? undefined),
  });

  const router = useRouter();
  const requireAuth = (cb: () => void) => {
    if (!signedIn) {
      router.navigate({ to: "/auth" });
      return;
    }
    cb();
  };

  const [activePost, setActivePost] = useState<Post | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [followListKind, setFollowListKind] = useState<FollowListKind | null>(null);
  const openFollowList = (kind: FollowListKind) => setFollowListKind(kind);
  const shareProfile = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = `${t.display_name ?? t.username} — LEER`;
    try {
      if (typeof navigator !== "undefined" && (navigator as { share?: (d: { title: string; url: string }) => Promise<void> }).share) {
        await (navigator as { share: (d: { title: string; url: string }) => Promise<void> }).share({ title, url });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success("Profile link copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* user cancelled */
    }
  };
  type TabValue = "feed" | "shorts" | "coaching";
  const TAB_VALUES: TabValue[] = ["feed", "shorts", "coaching"];
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab: TabValue = (TAB_VALUES as string[]).includes(search.tab)
    ? (search.tab as TabValue)
    : "feed";
  const setTab = (v: TabValue) => {
    void navigate({
      search: (prev) => ({ ...prev, tab: v }),
      replace: true,
      resetScroll: false,
    });
  };

  return (
    <article className="pb-16 pt-6 sm:pt-8" aria-labelledby="trainer-profile-heading">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Instagram-Style Header */}
        <header className="space-y-5">
          {/* Top Row: Avatar + Stats */}
          <div className="flex items-center gap-6 sm:gap-10">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-border bg-card shadow-lg ring-2 ring-primary/20 sm:h-24 sm:w-24 md:h-28 md:w-28">
                {t.avatar_url ? (
                  <img
                    src={t.avatar_url}
                    alt={t.display_name ?? t.username ?? "Trainer"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-display text-2xl font-bold uppercase text-muted-foreground sm:text-3xl">
                    {(t.display_name ?? t.username ?? "?")[0]?.toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex flex-1 items-center justify-around text-center sm:justify-start sm:gap-8">
              <div>
                <span className="block font-display text-lg font-bold tabular-nums sm:text-xl">
                  {t.posts.length}
                </span>
                <span className="text-xs text-muted-foreground">Posts</span>
              </div>
              <button
                type="button"
                onClick={() => openFollowList("followers")}
                className="text-center outline-none transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
              >
                <span className="block font-display text-lg font-bold tabular-nums sm:text-xl">
                  {followers.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">Followers</span>
              </button>
              <button
                type="button"
                onClick={() => openFollowList("following")}
                className="text-center outline-none transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
              >
                <span className="block font-display text-lg font-bold tabular-nums sm:text-xl">
                  {following.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">Following</span>
              </button>
              <button
                type="button"
                onClick={() => openFollowList("subscribers")}
                className="text-center outline-none transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
              >
                <span className="block font-display text-lg font-bold tabular-nums sm:text-xl text-primary">
                  {subscribers.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">Subscribers</span>
              </button>
            </div>
          </div>

          {/* Identity & Bio */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h1 id="trainer-profile-heading" className="truncate font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {t.display_name ?? t.username}
              </h1>
              {t.is_verified && (
                <BadgeCheck className="h-5 w-5 shrink-0 text-primary" />
              )}
            </div>
            {t.username && (
              <p className="text-xs font-medium text-muted-foreground">
                @{t.username}
              </p>
            )}
            {t.country && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 text-primary" /> {t.country}
              </p>
            )}
            {t.bio && (
              <div className="pt-1">
                <p className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
                  {t.bio}
                </p>
                <TranslateToggle text={t.bio} />
              </div>
            )}
            {t.specialties.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {t.specialties.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-border/80 bg-card px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons row */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {currentUserId === t.user_id ? (
              <>
                <Button
                  size="sm"
                  onClick={() => router.navigate({ to: "/settings" })}
                  className="rounded-xl px-4 font-semibold uppercase tracking-wider text-xs"
                >
                  <Settings className="mr-1.5 h-3.5 w-3.5" />
                  Edit Profile
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={shareProfile}
                  className="rounded-xl px-4 font-semibold text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Share2 className="mr-1.5 h-3.5 w-3.5" />
                      Share
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                {/* Follow / Following Button */}
                <Button
                  size="sm"
                  disabled={followMut.isPending}
                  onClick={() => requireAuth(() => followMut.mutate())}
                  className={`rounded-xl px-4 font-bold uppercase tracking-wider text-xs transition-all ${
                    info?.isFollowing
                      ? "border border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-red-500/60 hover:bg-red-950/40 hover:text-red-300"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  {followMut.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : info?.isFollowing ? (
                    <>
                      <UserCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                      Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                      Follow
                    </>
                  )}
                </Button>

                {/* Subscribe / Unlock Button */}
                <UnlockCheckoutDialog
                  trainerId={t.user_id}
                  creatorName={t.display_name ?? t.username ?? "Creator"}
                  creatorUsername={t.username ?? undefined}
                  avatarUrl={t.avatar_url ?? undefined}
                  isVerified={t.is_verified}
                  subscriptionPrice={t.subscription_price}
                  monetizationEnabled={t.monetization_enabled}
                  hasEnoughPublicPosts={hasEnoughPublicPosts}
                  publicFeedCount={publicFeedCount}
                  minPublicPostsRequired={MIN_PUBLIC_POSTS}
                  isSubscribed={info?.isSubscribed}
                  dmsEnabled={t.dms_enabled}
                  triggerSize="sm"
                  triggerClassName="rounded-xl px-4 font-bold uppercase tracking-wider text-xs bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:from-amber-400 hover:to-amber-500"
                />

                {/* Message Button */}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!t.dms_enabled}
                  title={
                    !t.dms_enabled
                      ? "This creator has disabled direct messages"
                      : info?.isSubscribed
                        ? "Open direct messages"
                        : "Subscribe to send a direct message"
                  }
                  onClick={() =>
                    requireAuth(() => {
                      if (!info?.isSubscribed) {
                        toast.info("Subscribe to send this creator a direct message.");
                        return;
                      }
                      router.navigate({ to: "/messages", search: { to: t.user_id } });
                    })
                  }
                  className="rounded-xl px-3 text-xs"
                >
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                  {t.dms_enabled ? "Message" : "DMs Off"}
                </Button>

                {/* Ask Question Dialog Button ($300) */}
                <AskQuestionDialog
                  creatorId={t.user_id}
                  creatorName={t.display_name ?? t.username ?? "this creator"}
                  disabled={!t.monetization_enabled}
                />

                {/* Tip Button */}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!t.monetization_enabled}
                  title="Send a coaching tip"
                  onClick={() => requireAuth(() => setTipOpen(true))}
                  className="rounded-xl px-3 text-xs hover:border-primary/60 hover:text-primary"
                >
                  <Heart className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  Tip
                </Button>

                {/* Share Button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={shareProfile}
                  className="rounded-xl px-3 text-xs"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Share2 className="h-3.5 w-3.5" />
                  )}
                </Button>

                {/* Report Button */}
                <ReportButton trainerId={t.user_id} />
              </>
            )}
          </div>
        </header>

        {/* Highlights: specialties · pricing · upcoming sessions */}
        <section aria-label="Highlights and pricing" className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-display text-sm uppercase tracking-widest text-muted-foreground">
              <BadgeCheck className="h-4 w-4 text-primary" />
              About
            </h2>
            <p className="mt-4 text-sm text-muted-foreground">
              {t.value_proposition || t.bio || "Follow to see new drops, subscribe to unlock premium posts."}
            </p>
          </div>

          <aside className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 font-display text-sm uppercase tracking-widest text-muted-foreground">
                <Trophy className="h-4 w-4 text-primary" />
                Specialties
              </h2>
              {t.specialties.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No specialties listed yet.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.specialties.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] uppercase tracking-wider"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div
              className="rounded-xl p-5 shadow-elevated"
              style={{
                border: "1px solid color-mix(in oklch, var(--premium) 40%, transparent)",
                backgroundImage:
                  "linear-gradient(135deg, color-mix(in oklch, var(--premium) 14%, transparent), var(--card) 55%, var(--card))",
              }}
            >
              <p className="font-display text-[11px] uppercase tracking-widest text-muted-foreground">
                {currentUserId === t.user_id ? "Your Subscription Plan" : "Subscription"}
              </p>
              <p className="mt-1 font-display text-3xl text-premium">
                {t.monetization_enabled
                  ? `$${t.subscription_price.toFixed(2)}`
                  : "—"}
                {t.monetization_enabled && (
                  <span className="text-sm text-muted-foreground"> /mo</span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {currentUserId === t.user_id
                  ? "Trainees pay this price to unlock your premium drops and perks."
                  : "Premium posts, monthly video call, priority Q&A."}
              </p>
              {currentUserId === t.user_id ? (
                <Button
                  size="sm"
                  onClick={() => router.navigate({ to: "/settings" })}
                  className="mt-4 w-full bg-neutral-800 hover:bg-neutral-700 text-white font-semibold uppercase tracking-widest"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Edit Pricing & Perks
                </Button>
              ) : (
                <UnlockCheckoutDialog
                  trainerId={t.user_id}
                  creatorName={t.display_name ?? t.username ?? "Creator"}
                  creatorUsername={t.username ?? undefined}
                  avatarUrl={t.avatar_url ?? undefined}
                  isVerified={t.is_verified}
                  subscriptionPrice={t.subscription_price}
                  monetizationEnabled={t.monetization_enabled}
                  hasEnoughPublicPosts={hasEnoughPublicPosts}
                  publicFeedCount={publicFeedCount}
                  minPublicPostsRequired={MIN_PUBLIC_POSTS}
                  isSubscribed={info?.isSubscribed}
                  dmsEnabled={t.dms_enabled}
                  triggerSize="sm"
                  triggerClassName="mt-4 w-full bg-premium font-semibold uppercase tracking-widest"
                  triggerLabel={
                    !t.monetization_enabled
                      ? "Not accepting subscribers"
                      : !hasEnoughPublicPosts
                        ? `${publicFeedCount}/${MIN_PUBLIC_POSTS} public posts needed`
                        : "Subscribe"
                  }
                />
              )}
              {t.monetization_enabled && !hasEnoughPublicPosts && currentUserId !== t.user_id && !info?.isSubscribed && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  This creator needs at least {MIN_PUBLIC_POSTS} public posts before accepting subscribers.
                </p>
              )}
            </div>
          </aside>
        </section>

        {/* Tabs */}
        <section aria-label="Creator content" className="mt-10">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
        >
          <TabsList className="grid w-full grid-cols-3 sm:w-auto">
            <TabsTrigger value="feed" className="font-display uppercase tracking-widest text-xs">
              Feed
            </TabsTrigger>
            <TabsTrigger value="shorts" className="font-display uppercase tracking-widest text-xs">
              Shorts
            </TabsTrigger>
            <TabsTrigger value="coaching" className="font-display uppercase tracking-widest text-xs">
              Coaching
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="mt-6">
            <TabPanel tabKey={`feed-${tab === "feed"}`}>
              <PostGrid
                posts={feed}
                unlocked={unlocked}
                emptyLabel="No feed posts yet."
                onOpen={setActivePost}
                isSelf={currentUserId === t.user_id}
              />
              {publicFeedCount > 0 && premiumCount > 0 && currentUserId !== t.user_id && !info?.isSubscribed && (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Subscribe to unlock {premiumCount} premium{" "}
                  {premiumCount === 1 ? "post" : "posts"}.
                </p>
              )}
            </TabPanel>
          </TabsContent>

          <TabsContent value="shorts" className="mt-6">
            <TabPanel tabKey={`shorts-${tab === "shorts"}`}>
              <PostGrid
                posts={shorts}
                unlocked={unlocked}
                emptyLabel="No shorts yet."
                columns="shorts"
                onOpen={setActivePost}
                isSelf={currentUserId === t.user_id}
              />
            </TabPanel>
          </TabsContent>

          <TabsContent value="coaching" className="mt-6">
            <TabPanel tabKey={`coaching-${tab === "coaching"}`}>
              {signedIn && info?.isSubscribed && (
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="font-display text-lg uppercase tracking-tight text-foreground">
                    Coaching Threads
                  </h3>
                  <Button
                    size="sm"
                    className="rounded-full bg-premium uppercase tracking-widest text-white shadow-md transition-transform hover:scale-105 active:scale-95"
                    onClick={() => setComposerOpen(true)}
                  >
                    Submit Question
                  </Button>
                </div>
              )}
              
              <CommunityList
                posts={t.community_posts}
                trainerName={t.display_name ?? t.username ?? "Trainer"}
              />
              
              {!info?.isSubscribed && t.monetization_enabled && hasEnoughPublicPosts && (
                <div className="mt-6 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
                  <Lock className="mx-auto h-6 w-6 text-muted-foreground mb-3" />
                  <h3 className="font-display text-lg uppercase tracking-tight text-foreground">Subscribe to Unlock Coaching</h3>
                  <p className="mt-2 text-sm text-muted-foreground mb-4">
                    Get private workout feedback and direct Q&A access with {t.display_name ?? t.username}.
                  </p>
                  <UnlockCheckoutDialog
                    trainerId={t.user_id}
                    creatorName={t.display_name ?? t.username ?? "Creator"}
                    subscriptionPrice={t.subscription_price}
                    avatarUrl={t.avatar_url ?? undefined}
                    monetizationEnabled={t.monetization_enabled}
                    hasEnoughPublicPosts={hasEnoughPublicPosts}
                    publicFeedCount={publicFeedCount}
                    minPublicPostsRequired={MIN_PUBLIC_POSTS}
                    triggerLabel="Subscribe Now"
                    triggerClassName="w-full sm:w-auto bg-premium font-semibold uppercase tracking-widest text-white hover:bg-premium/90"
                  />
                </div>
              )}
            </TabPanel>
          </TabsContent>
        </Tabs>
        </section>
      </div>
      {activePost && (
        <PostDetailDialog
          post={activePost}
          open={!!activePost}
          onOpenChange={(o) => !o && setActivePost(null)}
          unlockedUrl={
            activePost.is_premium
              ? unlocked[activePost.id]?.media_url ??
                unlocked[activePost.id]?.thumbnail_url ??
                null
              : null
          }
          currentUserId={currentUserId}
          isSignedIn={signedIn}
        />
      )}
      
      <ComposeCommunityDialog
        open={composerOpen}
        onOpenChange={setComposerOpen}
        targetTrainerId={t.user_id}
      />
      
      <FollowListDialog
        open={followListKind !== null}
        onOpenChange={(o) => !o && setFollowListKind(null)}
        userId={t.user_id}
        kind={followListKind ?? "followers"}
      />
      <TipModal
        open={tipOpen}
        onOpenChange={setTipOpen}
        trainerId={t.user_id}
        trainerName={t.display_name ?? t.username ?? "this creator"}
        presets={[5, 10, 25]}
      />
      <CreatorMobileActionBar
        trainerId={t.user_id}
        creatorName={t.display_name ?? t.username ?? "Creator"}
        creatorUsername={t.username ?? undefined}
        avatarUrl={t.avatar_url ?? undefined}
        isVerified={t.is_verified}
        subscriptionPrice={t.subscription_price}
        monetizationEnabled={t.monetization_enabled}
        hasEnoughPublicPosts={hasEnoughPublicPosts}
        publicFeedCount={publicFeedCount}
        minPublicPostsRequired={MIN_PUBLIC_POSTS}
        isSubscribed={info?.isSubscribed}
        isFollowing={info?.isFollowing}
        dmsEnabled={t.dms_enabled}
        isPendingFollow={followMut.isPending}
        onFollowClick={() => requireAuth(() => followMut.mutate())}
        onMessageClick={() =>
          requireAuth(() => {
            if (!info?.isSubscribed) {
              toast.info("Subscribe to send this creator a direct message.");
              return;
            }
            router.navigate({ to: "/messages", search: { to: t.user_id } });
          })
        }
        onTipClick={() => requireAuth(() => setTipOpen(true))}
        isSelfProfile={currentUserId === t.user_id}
      />
    </article>
  );
}

function StatBlock({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="text-center sm:text-left">
      <dt className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground sm:justify-start">
        {icon}
        {label}
      </dt>
      <dd className="font-display text-2xl">{value}</dd>
    </div>
  );
}

function PostGrid({
  posts,
  unlocked,
  emptyLabel,
  columns = "feed",
  onOpen,
  isSelf = false,
}: {
  posts: Post[];
  unlocked: Record<string, { media_url: string; thumbnail_url: string | null }>;
  emptyLabel: string;
  columns?: "feed" | "shorts";
  onOpen?: (post: Post) => void;
  isSelf?: boolean;
}) {
  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }
  // Instagram-style 3-column feed on all breakpoints for the main feed;
  // shorts get a slightly airier 2→3→4 layout so vertical thumbs breathe.
  const gridClass =
    columns === "shorts"
      ? "grid grid-cols-2 gap-1 sm:grid-cols-3 sm:gap-2 md:grid-cols-4"
      : "grid grid-cols-3 gap-[3px] sm:gap-1.5";
  return (
    <div className={gridClass}>
      {posts.map((p) => (
        <PostTile
          key={p.id}
          post={p}
          onClick={() => onOpen?.(p)}
          unlockedUrl={
            p.is_premium
              ? isSelf
                ? (p.thumbnail_url || p.media_url || unlocked[p.id]?.thumbnail_url || unlocked[p.id]?.media_url)
                : (unlocked[p.id]?.thumbnail_url ?? unlocked[p.id]?.media_url ?? null)
              : null
          }
        />
      ))}
    </div>
  );
}

function CommunityList({
  posts,
  trainerName,
}: {
  posts: TrainerCommunityPost[];
  trainerName: string;
}) {
  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        {trainerName} hasn’t posted in the community yet.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {posts.map((c) => (
        <article
          key={c.id}
          className="rounded-lg border border-border bg-card p-5"
        >
          <header className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              {c.kind === "question" ? (
                <>
                  <HelpCircle className="h-3 w-3" /> Q&amp;A
                </>
              ) : (
                <>
                  <Trophy className="h-3 w-3" /> FLEX
                </>
              )}
            </span>
            <span className="text-muted-foreground">
              {new Date(c.created_at).toLocaleDateString()}
            </span>
            {c.coaching_status === "pending" && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                <Clock className="h-3 w-3" /> Step 1: Pending
              </span>
            )}
            {c.coaching_status === "coached" && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                <MessageSquare className="h-3 w-3" /> Step 2: Coached
              </span>
            )}
            {c.coaching_status === "coaching_completed" && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                <Lock className="h-3 w-3" /> Completed &amp; Archived
              </span>
            )}
            {!c.coaching_status && c.trainer_answered && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-primary/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary">
                <BadgeCheck className="h-3 w-3" /> Trainer answered
              </span>
            )}
          </header>
          <h3 className="mt-3 font-display text-lg uppercase tracking-tight">
            {c.title}
          </h3>
          {c.body && (
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
              {c.body}
            </p>
          )}
          {c.hashtags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {c.hashtags.slice(0, 6).map((h) => (
                <span key={h} className="text-[11px] text-primary/80">
                  #{h}
                </span>
              ))}
            </div>
          )}
          <footer className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Dumbbell className="h-3.5 w-3.5" /> {c.respect_count}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" /> {c.comment_count} repl
              {c.comment_count === 1 ? "y" : "ies"}
            </span>
            <Link
              to="/community"
              className="ml-auto text-primary underline-offset-2 hover:underline"
            >
              Open thread →
            </Link>
          </footer>
        </article>
      ))}
    </div>
  );
}