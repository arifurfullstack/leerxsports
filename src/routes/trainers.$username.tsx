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
  HelpCircle,
  Trophy,
  Dumbbell,
  ArrowRight,
  Sparkles,
  Search,
} from "lucide-react";

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
  listTrainerClasses,
  type Post,
  type TrainerClass,
  type TrainerCommunityPost,
  type TrainerSummary,
} from "@/lib/trainer-functions";
import { TranslateToggle } from "@/components/translate-toggle";
import {
  cancelSubscription,
  getPremiumPostUrls,
  getSubscriptionInfo,
  subscribeToTrainer,
  toggleFollow,
  type SubscriptionInfo,
} from "@/lib/subscription-functions";
import { supabase } from "@/integrations/supabase/client";
import { PostTile } from "@/components/post-tile";
import { PostDetailDialog } from "@/components/post-detail-dialog";
import { CoachingRequestDialog } from "@/components/coaching-request-dialog";
import { ReportDialog } from "@/components/report-dialog";
import { TabPanel, TabGridSkeleton } from "@/components/tab-panel";
import {
  applyOptimisticFollow,
  rollbackOptimisticFollow,
  reconcileFollowFromServer,
  invalidateFollow,
  type FollowMutationContext,
  applyOptimisticSubscribe,
  rollbackOptimisticSubscribe,
  type SubscribeMutationContext,
} from "@/lib/follow-optimistic";

function ReportButton({ trainerId }: { trainerId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 flex items-center gap-1 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-destructive"
      >
        <Flag className="h-3 w-3" /> Report
      </button>
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
          placeholder="Search trainers by name or handle"
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
    const data = await context.queryClient.ensureQueryData(
      trainerQuery(params.username),
    );
    if (!data) throw notFound();
    return data;
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
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <h1 className="font-display text-2xl">Could not load trainer</h1>
        <p className="text-muted-foreground">{error.message}</p>
        <Button
          className="mt-4"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Retry
        </Button>
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
            <Link to="/trainers">Browse all trainers</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/explore">Explore the platform</Link>
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
    enabled: signedIn && !!infoQ.data?.isSubscribed,
  });

  const info: SubscriptionInfo | undefined = infoQ.data;
  const unlocked = unlockedQ.data ?? {};

  const subFn = useServerFn(subscribeToTrainer);
  const cancelFn = useServerFn(cancelSubscription);
  const followFn = useServerFn(toggleFollow);

  const subscribeMut = useMutation({
    mutationFn: () => subFn({ data: { trainerId: t.user_id } }),
    onMutate: () => applyOptimisticSubscribe(qc, t.user_id, true),
    onError: (e: Error, _v, ctx: SubscribeMutationContext | undefined) => {
      rollbackOptimisticSubscribe(qc, t.user_id, ctx);
      toast.error(e.message);
    },
    onSuccess: () => {
      toast.success(`Subscribed to ${t.display_name ?? t.username}`);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["subscription-info", t.user_id] });
      qc.invalidateQueries({ queryKey: ["premium-urls", t.user_id] });
      qc.invalidateQueries({ queryKey: ["follow-counts", t.user_id] });
    },
  });
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
    mutationFn: () => followFn({ data: { trainerId: t.user_id } }),
    onMutate: () => applyOptimisticFollow(qc, t.user_id),
    onError: (e: Error, _v, ctx: FollowMutationContext | undefined) => {
      rollbackOptimisticFollow(qc, t.user_id, ctx);
      toast.error(e.message);
    },
    onSuccess: (res, _v, ctx: FollowMutationContext | undefined) => {
      // Server response is the source of truth — correct any optimistic drift.
      reconcileFollowFromServer(qc, t.user_id, ctx, res.following);
      toast.success(res.following ? "Following" : "Unfollowed");
    },
    onSettled: () => invalidateFollow(qc, t.user_id),
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
  const [askOpen, setAskOpen] = useState(false);
  type TabValue = "feed" | "shorts" | "classes" | "community" | "coaching";
  const TAB_VALUES: TabValue[] = [
    "feed",
    "shorts",
    "classes",
    "community",
    "coaching",
  ];
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab: TabValue = (TAB_VALUES as string[]).includes(search.tab)
    ? (search.tab as TabValue)
    : "feed";
  const setTab = (v: TabValue) => {
    navigate({
      search: (prev: { tab: string }) => ({ ...prev, tab: v }),
      replace: true,
      resetScroll: false,
    });
  };

  const upcomingClasses = t.classes.slice(0, 3);

  return (
    <article className="pb-16" aria-labelledby="trainer-profile-heading">
      {/* Cover */}
      <div
        role="img"
        aria-label={`${t.display_name ?? t.username ?? "Trainer"} cover image`}
        className="h-48 w-full bg-muted sm:h-64"
        style={{
          backgroundImage: t.cover_url ? `url(${t.cover_url})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="-mt-14 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-end gap-3 sm:gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-background bg-muted sm:h-28 sm:w-28 md:h-32 md:w-32">
              {t.avatar_url ? (
                <img
                  src={t.avatar_url}
                  alt={t.display_name ?? t.username ?? "Trainer"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-display text-3xl text-muted-foreground">
                  {(t.display_name ?? t.username ?? "?")[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 pb-2">
              <div className="flex items-center gap-1.5">
                <h1 id="trainer-profile-heading" className="truncate font-display text-xl uppercase tracking-tight sm:text-2xl md:text-3xl">
                  {t.display_name ?? t.username}
                </h1>
                {t.is_verified && (
                  <BadgeCheck className="h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5" />
                )}
              </div>
              {t.username && (
                <p className="truncate text-xs text-muted-foreground sm:text-sm">
                  @{t.username}
                </p>
              )}
              {t.country && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {t.country}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:gap-x-4 sm:text-sm">
                <span>
                  <span className="font-semibold tabular-nums">{followers.toLocaleString()}</span>{" "}
                  <span className="text-muted-foreground">
                    {followers === 1 ? "Follower" : "Followers"}
                  </span>
                </span>
                <span>
                  <span className="font-semibold tabular-nums">{following.toLocaleString()}</span>{" "}
                  <span className="text-muted-foreground">Following</span>
                </span>
                <span>
                  <span className="font-semibold tabular-nums">{subscribers.toLocaleString()}</span>{" "}
                  <span className="text-muted-foreground">
                    {subscribers === 1 ? "Subscriber" : "Subscribers"}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-stretch gap-2 pb-2 sm:flex-col sm:items-end [&_button]:flex-1 sm:[&_button]:flex-none">
            <Button
              size="sm"
              variant={info?.isFollowing ? "secondary" : "outline"}
              disabled={followMut.isPending}
              onClick={() => requireAuth(() => followMut.mutate())}
              aria-pressed={!!info?.isFollowing}
              aria-label={info?.isFollowing ? "Unfollow this trainer" : "Follow this trainer"}
            >
              {followMut.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {info?.isFollowing ? "Following" : "Follow"}
            </Button>
            {info?.isSubscribed ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={cancelMut.isPending}
                onClick={() => requireAuth(() => cancelMut.mutate())}
              >
                {cancelMut.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Subscribed · Cancel
              </Button>
            ) : (
              <Button
                size="sm"
                className="premium-glow"
                disabled={subscribeMut.isPending || !t.monetization_enabled}
                onClick={() => requireAuth(() => subscribeMut.mutate())}
              >
                {subscribeMut.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                {t.monetization_enabled
                  ? `Subscribe · $${t.subscription_price.toFixed(2)}/mo`
                  : "Not accepting subscribers"}
              </Button>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!t.dms_enabled}
                title={
                  !t.dms_enabled
                    ? "This trainer has disabled direct messages"
                    : info?.isSubscribed
                      ? "Open direct messages"
                      : "Subscribe to send a direct message"
                }
                onClick={() =>
                  requireAuth(() => {
                    if (!info?.isSubscribed) {
                      toast.info("Subscribe to send this trainer a direct message.");
                      return;
                    }
                    router.navigate({ to: "/messages", search: { to: t.user_id } });
                  })
                }
              >
                <MessageSquare className="mr-1 h-3.5 w-3.5" />
                {t.dms_enabled ? "Message" : "DMs off"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  requireAuth(() => {
                    if (!info?.isSubscribed) {
                      toast.info("Subscribe to request private coaching.");
                      return;
                    }
                    setTab("coaching");
                    setAskOpen(true);
                  })
                }
              >
                Request coaching
              </Button>
            </div>
            <ReportButton trainerId={t.user_id} />
          </div>
        </header>

        {/* Bio + stats */}
        <section aria-label="About this trainer" className="mt-6 grid gap-6 sm:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            {t.value_proposition && (
              <p className="font-display uppercase tracking-wide text-foreground">
                {t.value_proposition}
              </p>
            )}
            {t.bio && (
              <div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {t.bio}
                </p>
                <TranslateToggle text={t.bio} />
              </div>
            )}
            {t.specialties.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {t.specialties.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-border px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
          <dl className="grid grid-cols-3 gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-1">
            <StatBlock label="Posts" value={t.posts.length} />
            <StatBlock label="Shorts" value={shorts.length} />
            <StatBlock label="Premium" value={premiumCount} icon={<Lock className="h-3 w-3" />} />
          </dl>
        </section>

        {/* Highlights: specialties · pricing · upcoming sessions */}
        <section aria-label="Highlights and pricing" className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-sm uppercase tracking-widest text-muted-foreground">
                <CalendarDays className="h-4 w-4 text-primary" />
                Upcoming Sessions
              </h2>
              {t.classes.length > 3 && (
                <button
                  type="button"
                  onClick={() => setTab("classes")}
                  className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-primary hover:underline"
                >
                  See all {t.classes.length} <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
            {upcomingClasses.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No sessions on the calendar right now — check back soon.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {upcomingClasses.map((c) => {
                  const d = new Date(c.schedule);
                  return (
                    <li key={c.id}>
                      <Link
                        to="/classes/$classId"
                        params={{ classId: c.id }}
                        className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-muted/40 text-center">
                          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            {d.toLocaleDateString(undefined, { month: "short" })}
                          </span>
                          <span className="font-display text-xl leading-none">
                            {d.getDate()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-display text-base uppercase tracking-tight group-hover:text-primary">
                            {c.title}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {d.toLocaleString(undefined, {
                              weekday: "short",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                            {c.duration_minutes ? ` · ${c.duration_minutes} min` : ""}
                            {c.level ? ` · ${c.level}` : ""}
                            {c.location ? ` · ${c.location}` : ""}
                          </p>
                        </div>
                        <span className="font-display text-sm text-primary">
                          ${c.price.toFixed(2)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 font-display text-sm uppercase tracking-widest text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
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

            <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5">
              <p className="font-display text-[11px] uppercase tracking-widest text-muted-foreground">
                Subscription
              </p>
              <p className="mt-1 font-display text-3xl text-primary">
                {t.monetization_enabled
                  ? `$${t.subscription_price.toFixed(2)}`
                  : "—"}
                {t.monetization_enabled && (
                  <span className="text-sm text-muted-foreground"> /mo</span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Premium posts, monthly video call, priority Q&amp;A.
              </p>
              <Button
                size="sm"
                className="mt-4 w-full"
                disabled={
                  !t.monetization_enabled ||
                  info?.isSubscribed ||
                  subscribeMut.isPending
                }
                onClick={() => requireAuth(() => subscribeMut.mutate())}
              >
                {info?.isSubscribed
                  ? "Subscribed"
                  : t.monetization_enabled
                    ? subscribeMut.isPending
                      ? "Subscribing…"
                      : "Subscribe"
                    : "Not accepting subscribers"}
              </Button>
            </div>
          </aside>
        </section>

        {/* Tabs */}
        <section aria-label="Trainer content" className="mt-10">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
        >
          <TabsList className="grid w-full grid-cols-5 sm:w-auto">
            <TabsTrigger value="feed" className="font-display uppercase tracking-widest text-xs">
              Feed
            </TabsTrigger>
            <TabsTrigger value="shorts" className="font-display uppercase tracking-widest text-xs">
              Shorts
            </TabsTrigger>
            <TabsTrigger value="classes" className="font-display uppercase tracking-widest text-xs">
              Classes
            </TabsTrigger>
            <TabsTrigger value="community" className="font-display uppercase tracking-widest text-xs">
              Community
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
              />
              {publicFeedCount > 0 && premiumCount > 0 && !info?.isSubscribed && (
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
              />
            </TabPanel>
          </TabsContent>

          <TabsContent value="classes" className="mt-6">
            <TabPanel tabKey={`classes-${tab === "classes"}`}>
              <ClassGrid
                username={t.username ?? ""}
                initialClasses={t.classes}
              />
            </TabPanel>
          </TabsContent>

          <TabsContent value="community" className="mt-6">
            <TabPanel tabKey={`community-${tab === "community"}`}>
              <CommunityList
                posts={t.community_posts}
                trainerName={t.display_name ?? t.username ?? "Trainer"}
              />
            </TabPanel>
          </TabsContent>

          <TabsContent value="coaching" className="mt-6">
            <TabPanel tabKey={`coaching-${tab === "coaching"}`}>
              <CoachingPanel
                price={t.subscription_price}
                monetizationEnabled={t.monetization_enabled}
                isSubscribed={!!info?.isSubscribed}
                credit={info?.credit ?? null}
                onSubscribe={() => requireAuth(() => subscribeMut.mutate())}
                subscribing={subscribeMut.isPending}
                onAsk={() => requireAuth(() => setAskOpen(true))}
              />
            </TabPanel>
          </TabsContent>
        </Tabs>
        </section>
      </div>
      <CoachingRequestDialog
        open={askOpen}
        onOpenChange={setAskOpen}
        trainerId={t.user_id}
        trainerName={t.display_name ?? t.username ?? "Trainer"}
      />
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
}: {
  posts: Post[];
  unlocked: Record<string, { media_url: string; thumbnail_url: string | null }>;
  emptyLabel: string;
  columns?: "feed" | "shorts";
  onOpen?: (post: Post) => void;
}) {
  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }
  const gridClass =
    columns === "shorts"
      ? "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
      : "grid grid-cols-3 gap-1 sm:gap-2";
  return (
    <div className={gridClass}>
      {posts.map((p) => (
        <PostTile
          key={p.id}
          post={p}
          onClick={() => onOpen?.(p)}
          unlockedUrl={
            p.is_premium
              ? unlocked[p.id]?.thumbnail_url ?? unlocked[p.id]?.media_url ?? null
              : null
          }
        />
      ))}
    </div>
  );
}

function CoachingPanel({
  price,
  monetizationEnabled,
  isSubscribed,
  credit,
  onSubscribe,
  subscribing,
  onAsk,
}: {
  price: number;
  monetizationEnabled: boolean;
  isSubscribed: boolean;
  credit: SubscriptionInfo["credit"];
  onSubscribe: () => void;
  subscribing: boolean;
  onAsk: () => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-lg border border-border bg-card p-5">
        <Users className="h-5 w-5 text-primary" />
        <h3 className="mt-3 font-display text-lg uppercase">Subscription</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Unlock premium content and one monthly video coaching call.
        </p>
        <p className="mt-3 font-display text-2xl text-primary">
          ${price.toFixed(2)}
          <span className="text-sm text-muted-foreground">/mo</span>
        </p>
        <Button
          className="mt-4 w-full"
          disabled={!monetizationEnabled || isSubscribed || subscribing}
          onClick={onSubscribe}
        >
          {isSubscribed
            ? "Active"
            : monetizationEnabled
              ? subscribing
                ? "Subscribing…"
                : "Subscribe"
              : "Coming Soon"}
        </Button>
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        <Video className="h-5 w-5 text-primary" />
        <h3 className="mt-3 font-display text-lg uppercase">Video Call</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          One private video coaching call included every active month. No
          rollover.
        </p>
        <Button
          variant="outline"
          className="mt-4 w-full"
          disabled={!isSubscribed || !credit || credit.status !== "available"}
        >
          {!isSubscribed
            ? "Requires Subscription"
            : credit?.status === "available"
              ? "1 credit available"
              : "Used this month"}
        </Button>
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h3 className="mt-3 font-display text-lg uppercase">Ask a Question</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Post a structured coaching question. One follow-up allowed per
          answer.
        </p>
        <Button
          variant="outline"
          className="mt-4 w-full"
          disabled={!isSubscribed || !credit || credit.status !== "available"}
          onClick={onAsk}
        >
          {!isSubscribed
            ? "Requires Subscription"
            : credit?.status === "available"
              ? "Ask a Question"
              : "Credit Used This Month"}
        </Button>
      </div>
    </div>
  );
}

function ClassGrid({
  username,
  initialClasses,
}: {
  username: string;
  initialClasses: TrainerClass[];
}) {
  function ClassCardSkeleton() {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Skeleton className="h-32 w-full rounded-none" />
        <div className="space-y-3 p-4">
          <div className="flex gap-1">
            <Skeleton className="h-4 w-14 rounded-full" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
          <Skeleton className="h-5 w-3/4" />
          <div className="flex items-center justify-between pt-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-10" />
          </div>
        </div>
      </div>
    );
  }
  const listFn = useServerFn(listTrainerClasses);
  const INITIAL_LIMIT = 24;
  const PAGE_LIMIT = 12;
  const [sort, setSort] = useState<
    "date-asc" | "date-desc" | "price-asc" | "price-desc"
  >("date-asc");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState("all");
  const [level, setLevel] = useState("all");
  const [selected, setSelected] = useState<TrainerClass | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const serverCategory = category === "all" ? null : category;
  const serverLevel = level === "all" ? null : level;
  const infinite = useInfiniteQuery({
    queryKey: ["trainer-classes", username, sort, serverCategory, serverLevel],
    enabled: !!username,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      if (
        pageParam === 0 &&
        sort === "date-asc" &&
        !serverCategory &&
        !serverLevel
      ) {
        return Promise.resolve({
          items: initialClasses,
          nextOffset:
            initialClasses.length < INITIAL_LIMIT ? null : INITIAL_LIMIT,
        });
      }
      if (pageParam === 0) {
        return listFn({
          data: {
            username,
            offset: 0,
            limit: INITIAL_LIMIT,
            sort,
            category: serverCategory,
            level: serverLevel,
          },
        });
      }
      return listFn({
        data: {
          username,
          offset: pageParam as number,
          limit: PAGE_LIMIT,
          sort,
          category: serverCategory,
          level: serverLevel,
        },
      });
    },
    getNextPageParam: (last) => last.nextOffset,
    initialData:
      sort === "date-asc" && !serverCategory && !serverLevel
        ? {
            pages: [
              {
                items: initialClasses,
                nextOffset:
                  initialClasses.length < INITIAL_LIMIT ? null : INITIAL_LIMIT,
              },
            ],
            pageParams: [0],
          }
        : undefined,
  });

  const classes = useMemo(
    () => (infinite.data?.pages ?? []).flatMap((p) => p.items),
    [infinite.data],
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (
        entries[0]?.isIntersecting &&
        infinite.hasNextPage &&
        !infinite.isFetchingNextPage
      ) {
        infinite.fetchNextPage();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [infinite.hasNextPage, infinite.isFetchingNextPage, infinite]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const c of initialClasses) if (c.category) set.add(c.category);
    for (const c of classes) if (c.category) set.add(c.category);
    return Array.from(set).sort();
  }, [classes, initialClasses]);

  const levels = useMemo(() => {
    const set = new Set<string>();
    for (const c of initialClasses) if (c.level) set.add(c.level);
    for (const c of classes) if (c.level) set.add(c.level);
    return Array.from(set).sort();
  }, [classes, initialClasses]);

  const filtered = useMemo(() => {
    const fromTs = from ? new Date(from + "T00:00:00").getTime() : null;
    const toTs = to ? new Date(to + "T23:59:59").getTime() : null;
    return classes.filter((c) => {
      const ts = new Date(c.schedule).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      return true;
    });
  }, [classes, from, to]);

  const activeFilters =
    from || to || category !== "all" || level !== "all";

  const hasAnyClasses = initialClasses.length > 0 || classes.length > 0;
  const filterBar = hasAnyClasses && (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          From
        </label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          To
        </label>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Session type
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="all">All</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Level
        </label>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="all">All</option>
          {levels.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Sort by
        </label>
        <select
          value={sort}
          onChange={(e) =>
            setSort(
              e.target.value as
                | "date-asc"
                | "date-desc"
                | "price-asc"
                | "price-desc",
            )
          }
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="date-asc">Date: soonest</option>
          <option value="date-desc">Date: latest</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
      </div>
      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {filtered.length} of {classes.length}
        </span>
        {activeFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setFrom("");
              setTo("");
              setCategory("all");
              setLevel("all");
            }}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );

  if (!hasAnyClasses) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No upcoming classes.
      </div>
    );
  }
  if (infinite.isError && classes.length === 0) {
    return (
      <TabPanel
        state="error"
        error={infinite.error}
        onRetry={() => infinite.refetch()}
      />
    );
  }
  if (infinite.isLoading && classes.length === 0) {
    return (
      <div>
        {filterBar}
        <TabGridSkeleton
          count={6}
          columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          aspect="aspect-[3/2]"
        />
      </div>
    );
  }
  return (
    <div>
      {filterBar}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No classes match these filters.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => setSelected(c)}
          className="group overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <div
            className="h-32 w-full bg-muted"
            style={{
              backgroundImage: c.image_url ? `url(${c.image_url})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="p-4">
            <div className="flex flex-wrap items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              {c.category && (
                <span className="rounded-full border border-border px-2 py-0.5">
                  {c.category}
                </span>
              )}
              {c.level && (
                <span className="rounded-full border border-border px-2 py-0.5">
                  {c.level}
                </span>
              )}
            </div>
            <h3 className="mt-2 line-clamp-2 font-display text-lg">{c.title}</h3>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                {new Date(c.schedule).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <span className="font-display text-primary">
                ${c.price.toFixed(2)}
              </span>
            </div>
          </div>
        </button>
          ))}
        </div>
      )}
      {infinite.hasNextPage && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <div ref={sentinelRef} aria-hidden className="h-1 w-full" />
          {infinite.isFetchingNextPage && (
            <div className="mt-2 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <ClassCardSkeleton key={i} />
              ))}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => infinite.fetchNextPage()}
            disabled={infinite.isFetchingNextPage}
          >
            {infinite.isFetchingNextPage ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Loading…
              </>
            ) : (
              "Load more programs"
            )}
          </Button>
        </div>
      )}
      {!infinite.hasNextPage &&
        !infinite.isFetchingNextPage &&
        classes.length > 0 && (
          <div
            role="status"
            aria-live="polite"
            className="mt-8 flex flex-col items-center gap-1 border-t border-border pt-6 text-center"
          >
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              End of results
            </span>
            <p className="text-sm text-muted-foreground">
              No more programs — you've reached the end.
            </p>
          </div>
        )}
      <ClassDetailsDrawer
        cls={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function ClassDetailsDrawer({
  cls,
  onClose,
}: {
  cls: TrainerClass | null;
  onClose: () => void;
}) {
  return (
    <Drawer open={!!cls} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-h-[90vh]">
        {cls && (
          <>
            {cls.image_url && (
              <div
                className="h-48 w-full bg-muted"
                style={{
                  backgroundImage: `url(${cls.image_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            )}
            <DrawerHeader className="text-left">
              <div className="flex flex-wrap items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                {cls.category && (
                  <span className="rounded-full border border-border px-2 py-0.5">
                    {cls.category}
                  </span>
                )}
                {cls.level && (
                  <span className="rounded-full border border-border px-2 py-0.5">
                    {cls.level}
                  </span>
                )}
              </div>
              <DrawerTitle className="font-display text-2xl">
                {cls.title}
              </DrawerTitle>
              <DrawerDescription>
                {new Date(cls.schedule).toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {cls.duration_minutes ? ` • ${cls.duration_minutes} min` : ""}
                {cls.location ? ` • ${cls.location}` : ""}
              </DrawerDescription>
            </DrawerHeader>
            <div className="max-h-[40vh] overflow-y-auto px-4 pb-2 text-sm text-muted-foreground">
              {cls.description ? (
                <p className="whitespace-pre-wrap">{cls.description}</p>
              ) : (
                <p className="italic">No description provided.</p>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
              <span className="text-muted-foreground">Price</span>
              <span className="font-display text-lg text-primary">
                ${cls.price.toFixed(2)}
              </span>
            </div>
            <DrawerFooter className="flex-row gap-2">
              <Button asChild className="flex-1">
                <Link to="/classes/$classId" params={{ classId: cls.id }}>
                  View full details
                </Link>
              </Button>
              <DrawerClose asChild>
                <Button variant="outline">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
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
            {c.trainer_answered && (
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