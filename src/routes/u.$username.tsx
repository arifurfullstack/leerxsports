import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { queryOptions, useSuspenseQuery, useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { getTraineeProfile, updateTraineeProfile, getTraineePosts } from "@/lib/transformation-functions";
import { getFollowCounts } from "@/lib/trainer-functions";
import { getFollowState, toggleFollow } from "@/lib/subscription-functions";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PostDetailDialog } from "@/components/post-detail-dialog";
import { LazyImage } from "@/components/ui/lazy-image";
import {
  Play,
  MapPin,
  Languages,
  Target,
  Dumbbell,
  Share2,
  Ruler,
  Scale,
  Percent,
  Activity,
  Trophy,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  X,
  Flame,
  Camera,
  CalendarDays,
  BadgeCheck,
  Zap,
  Pencil,
  Plus,
  Trash2,
  Loader2,
  Link as LinkIcon,
  UserPlus,
  UserCheck,
  Users,
  LayoutGrid,
  Heart,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { TabPanel } from "@/components/tab-panel";
import { VerifiedBadge } from "@/components/verified-badge";

const traineeQueryOptions = (username: string) =>
  queryOptions({
    queryKey: ["trainee-profile", username],
    queryFn: () => getTraineeProfile({ data: { username } }),
  });

export const Route = createFileRoute("/u/$username")({
  validateSearch: zodValidator(
    z.object({
      tab: fallback(z.string(), "transformation").default("transformation"),
    }),
  ),
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(traineeQueryOptions(params.username));
    } catch (e) {
      if (e instanceof Error && /not found/i.test(e.message)) throw notFound();
      throw e;
    }
  },
  head: ({ loaderData }) => {
    const name = loaderData?.display_name ?? loaderData?.username ?? "Trainee";
    const desc = loaderData?.bio?.slice(0, 155) ??
      `${name}'s LEER Sports fitness journey and body transformation log.`;
    const og = loaderData?.avatar_url ?? loaderData?.cover_url ?? undefined;
    return {
      meta: [
        { title: `${name} — LEER Sports` },
        { name: "description", content: desc },
        { property: "og:title", content: `${name} — LEER Sports` },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        ...(og && /^https?:\/\//.test(og)
          ? [
              { property: "og:image", content: og },
              { name: "twitter:image", content: og },
            ]
          : []),
        { name: "twitter:card", content: og ? "summary_large_image" : "summary" },
      ],
    };
  },
  component: TraineePage,
  errorComponent: TraineeError,
  notFoundComponent: TraineeNotFound,
});

function TraineePage() {
  const { username } = Route.useParams();
  const { data: p } = useSuspenseQuery(traineeQueryOptions(username));
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab: "transformation" | "records" =
    search.tab === "records" ? "records" : "transformation";
  const setTab = (v: string) =>
    navigate({
      search: (prev: { tab: string }) => ({ ...prev, tab: v }),
      replace: true,
      resetScroll: false,
    });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setCurrentUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setCurrentUserId(session?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  const isOwner = currentUserId != null && currentUserId === p.user_id;
  const qc = useQueryClient();
  const targetId = p.user_id as string;
  const followCountsKey = ["follow-counts", targetId] as const;
  const followStateKey = ["follow-state", targetId, currentUserId] as const;
  const fetchCounts = useServerFn(getFollowCounts);
  const fetchState = useServerFn(getFollowState);
  const runToggle = useServerFn(toggleFollow);
  const countsQ = useQuery({
    queryKey: followCountsKey,
    queryFn: () => fetchCounts({ data: { userId: targetId } }),
    staleTime: 30_000,
  });
  const stateQ = useQuery({
    queryKey: followStateKey,
    queryFn: () => fetchState({ data: { userId: targetId } }),
    enabled: !!currentUserId && !isOwner,
    staleTime: 30_000,
  });
  const isFollowing = stateQ.data?.isFollowing ?? false;
  const followMut = useMutation({
    scope: { id: `follow:${targetId}` },
    mutationFn: () => runToggle({ data: { trainerId: targetId } }),
    onMutate: async () => {
      await Promise.all([
        qc.cancelQueries({ queryKey: followCountsKey }),
        qc.cancelQueries({ queryKey: followStateKey }),
      ]);
      const prevCounts = qc.getQueryData<{ followers: number; following: number; subscribers: number }>(followCountsKey);
      const prevState = qc.getQueryData<{ isFollowing: boolean }>(followStateKey);
      const willFollow = !(prevState?.isFollowing ?? false);
      if (prevCounts) {
        qc.setQueryData(followCountsKey, {
          ...prevCounts,
          followers: Math.max(0, prevCounts.followers + (willFollow ? 1 : -1)),
        });
      }
      qc.setQueryData(followStateKey, { isFollowing: willFollow });
      const viewerCountsKey = currentUserId
        ? (["follow-counts", currentUserId] as const)
        : null;
      let prevViewerCounts:
        | { followers: number; following: number; subscribers: number }
        | undefined;
      if (viewerCountsKey && currentUserId !== targetId) {
        prevViewerCounts = qc.getQueryData(viewerCountsKey);
        if (prevViewerCounts) {
          qc.setQueryData(viewerCountsKey, {
            ...prevViewerCounts,
            following: Math.max(
              0,
              prevViewerCounts.following + (willFollow ? 1 : -1),
            ),
          });
        }
      }
      return { prevCounts, prevState, prevViewerCounts };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prevCounts) qc.setQueryData(followCountsKey, ctx.prevCounts);
      if (ctx?.prevState) qc.setQueryData(followStateKey, ctx.prevState);
      if (ctx?.prevViewerCounts && currentUserId) {
        qc.setQueryData(["follow-counts", currentUserId], ctx.prevViewerCounts);
      }
      toast.error(err instanceof Error ? err.message : "Couldn't update follow");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: followCountsKey });
      qc.invalidateQueries({ queryKey: followStateKey });
      if (currentUserId && currentUserId !== targetId) {
        qc.invalidateQueries({ queryKey: ["follow-counts", currentUserId] });
      }
    },
  });
  const onFollowClick = () => {
    if (!currentUserId) {
      toast.info("Sign in to follow athletes");
      return;
    }
    followMut.mutate();
  };
  const initials = (p.display_name ?? p.username ?? "?")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const stats = [
    { label: "Height", value: p.height_cm ? `${p.height_cm}` : null, unit: "cm", Icon: Ruler },
    { label: "Weight", value: p.weight_kg ? `${p.weight_kg}` : null, unit: "kg", Icon: Scale },
    { label: "Body Fat", value: p.body_fat_percent ? `${p.body_fat_percent}` : null, unit: "%", Icon: Percent },
    { label: "Muscle", value: p.skeletal_muscle_kg ? `${p.skeletal_muscle_kg}` : null, unit: "kg", Icon: Activity },
    { label: "Level", value: p.experience_level ?? null, unit: "", Icon: Trophy },
  ].filter((s) => s.value);

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = `${p.display_name ?? p.username} — LEER Sports`;
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Profile link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  const totalPosts = p.transformations.length;
  const firstEntry = totalPosts ? p.transformations[totalPosts - 1] : null;
  const spanDays = firstEntry
    ? Math.max(1, Math.round((Date.now() - new Date(firstEntry.captured_on).getTime()) / 86400000))
    : 0;

  return (
    <main className="min-h-dvh bg-background pb-16 pt-6 sm:pt-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Instagram-Style Header */}
        <header className="space-y-5">
          {/* Top Row: Avatar + Stats */}
          <div className="flex items-center gap-6 sm:gap-10">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-border bg-card shadow-lg ring-2 ring-primary/20 sm:h-24 sm:w-24 md:h-28 md:w-28">
                {p.avatar_url ? (
                  <img
                    src={p.avatar_url}
                    alt={`${p.display_name ?? p.username} avatar`}
                    className="h-full w-full object-cover"
                    loading="eager"
                    decoding="async"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-display text-2xl font-bold uppercase text-muted-foreground sm:text-3xl">
                    {initials}
                  </div>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex flex-1 items-center justify-around text-center sm:justify-start sm:gap-8">
              <div>
                <span className="block font-display text-lg font-bold tabular-nums sm:text-xl">
                  {totalPosts}
                </span>
                <span className="text-xs text-muted-foreground">Entries</span>
              </div>
              <div>
                <span className="block font-display text-lg font-bold tabular-nums sm:text-xl">
                  {countsQ.data?.followers ?? 0}
                </span>
                <span className="text-xs text-muted-foreground">Followers</span>
              </div>
              <div>
                <span className="block font-display text-lg font-bold tabular-nums sm:text-xl">
                  {countsQ.data?.following ?? 0}
                </span>
                <span className="text-xs text-muted-foreground">Following</span>
              </div>
              <div>
                <span className="block font-display text-lg font-bold tabular-nums sm:text-xl text-primary">
                  {spanDays}
                </span>
                <span className="text-xs text-muted-foreground">Days</span>
              </div>
            </div>
          </div>

          {/* Identity & Badges */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {p.display_name ?? p.username}
              </h1>
              {p.is_verified && <VerifiedBadge size="md" />}
            </div>
            <p className="text-xs font-medium text-muted-foreground">@{p.username}</p>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                <Flame className="h-3 w-3" /> Trainee
              </span>
              {p.experience_level && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Zap className="h-3 w-3 text-accent" /> {p.experience_level}
                </span>
              )}
              {p.country && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                  <MapPin className="h-3 w-3 text-primary" /> {p.country}
                </span>
              )}
              {p.goal && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                  <Target className="h-3 w-3 text-primary" /> {p.goal}
                </span>
              )}
            </div>

            {p.bio && (
              <p className="pt-1 whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
                {p.bio}
              </p>
            )}
          </div>

          {/* Action buttons row */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {!isOwner && (
              <Button
                onClick={onFollowClick}
                size="sm"
                disabled={followMut.isPending}
                className={`rounded-xl px-4 font-bold uppercase tracking-wider text-xs transition-all ${
                  isFollowing
                    ? "border border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-red-500/60 hover:bg-red-950/40 hover:text-rose-300"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {followMut.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : isFollowing ? (
                  <>
                    <UserCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                    <span>Follow</span>
                  </>
                )}
              </Button>
            )}

            <Button asChild size="sm" variant="outline" className="rounded-xl px-3 text-xs gap-1.5">
              <Link to="/trainers/$username" params={{ username: p.username ?? "" }}>
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>Trainer Profile</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>

            <Button onClick={share} variant="outline" size="sm" className="rounded-xl px-3 text-xs gap-1.5">
              <Share2 className="h-3.5 w-3.5" />
              <span>Share</span>
            </Button>

            {isOwner && (
              <Button
                onClick={() => setEditing(true)}
                size="sm"
                variant="outline"
                className="rounded-xl px-3 text-xs gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Edit Profile</span>
              </Button>
            )}
          </div>
        </header>

        {/* Social links */}
        {p.social_links && p.social_links.length > 0 && (
          <section
            aria-label="Links"
            className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-2"
          >
            {p.social_links.map((href: string) => {
              let host = href;
              try {
                host = new URL(href).hostname.replace(/^www\./, "");
              } catch {
                /* keep raw */
              }
              return (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/60 hover:text-primary"
                >
                  <LinkIcon className="h-3 w-3" /> {host}
                </a>
              );
            })}
          </section>
        )}

        {/* Bio full */}
        {p.bio && (
          <section className="mx-auto mt-8 max-w-3xl rounded-2xl border border-border/60 bg-card/40 p-5 text-center sm:mt-10 sm:p-6">
            <p className="whitespace-pre-line text-base leading-relaxed text-foreground">
              {p.bio}
            </p>
          </section>
        )}

        {/* Physical stats — modern bento */}
        {stats.length > 0 && (
          <section
            aria-label="Physical stats"
            className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
          >
            {stats.map(({ label, value, unit, Icon }) => (
              <div
                key={label}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10"
              >
                <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-primary/10 blur-2xl transition-opacity group-hover:opacity-90" />
                <div className="relative flex items-center justify-between">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {label}
                  </span>
                </div>
                <p className="relative mt-4 font-display text-3xl leading-none">
                  {value}
                  {unit && (
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      {unit}
                    </span>
                  )}
                </p>
              </div>
            ))}
          </section>
        )}

        {/* Tabs: Transformation / Posts / Records */}
        <section className="mt-10 pb-20">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList aria-label="Profile sections">
              <TabsTrigger
                value="transformation"
                className="gap-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Trophy className="h-3.5 w-3.5" /> Transformation
              </TabsTrigger>
              <TabsTrigger
                value="posts"
                className="gap-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Posts
              </TabsTrigger>
              <TabsTrigger
                value="records"
                className="gap-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Dumbbell className="h-3.5 w-3.5" /> Records
              </TabsTrigger>
            </TabsList>

            <TabsContent value="transformation" className="mt-5">
              <TabPanel tabKey="transformation">
                <TransformationGallery p={p} />
              </TabPanel>
            </TabsContent>

            <TabsContent value="posts" className="mt-5">
              <TabPanel tabKey="posts">
                <TraineePostsGallery userId={p.user_id} currentUserId={currentUserId} />
              </TabPanel>
            </TabsContent>

            <TabsContent value="records" className="mt-5">
              <TabPanel tabKey="records">
              {p.personal_records ? (
                <div className="rounded-xl border border-border bg-card p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Dumbbell className="h-4 w-4 text-primary" />
                    <h2 className="font-display text-sm uppercase tracking-widest">
                      Personal Records
                    </h2>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                    {p.personal_records}
                  </pre>
                </div>
              ) : (
                <EmptyBlock text="No personal records shared yet." />
              )}
              </TabPanel>
            </TabsContent>
          </Tabs>

          <div className="mt-14 rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-accent/10 p-6 text-center sm:p-8">
            <h3 className="font-display text-xl uppercase tracking-tight sm:text-2xl">
              Ready for the next chapter?
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Pair up with a creator who can guide {p.display_name ?? "this athlete"} toward the next milestone.
            </p>
            <Button asChild className="mt-4 gap-2">
              <Link to="/trainers">
                Browse creators <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </div>
      {isOwner && (
        <EditProfileDialog
          open={editing}
          onOpenChange={setEditing}
          profile={p}
          username={username}
        />
      )}
    </main>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function TraineePostsGallery({ userId, currentUserId }: { userId: string; currentUserId: string | null }) {
  const fetchPosts = useServerFn(getTraineePosts);
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["trainee-posts", userId],
    queryFn: () => fetchPosts({ data: { userId } }),
  });
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (posts.length === 0) {
    return <EmptyBlock text="No uploaded posts or media yet." />;
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-1 sm:gap-3">
        {posts.map((post) => (
          <button
            key={post.id}
            type="button"
            onClick={() => setSelectedPostId(post.id)}
            className="group relative aspect-square overflow-hidden rounded-md border border-border/40 bg-muted text-left focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <LazyImage
              src={post.thumbnail_url || post.media_url}
              alt={post.caption || "User post"}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {post.kind === "short" && (
              <span className="absolute right-1.5 top-1.5 rounded bg-black/70 p-1 text-white">
                <Play className="h-3 w-3 fill-current" />
              </span>
            )}
            <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="flex items-center gap-1 text-xs font-bold text-white">
                <Heart className="h-4 w-4 fill-white" /> {post.respect_count ?? 0}
              </span>
              <span className="flex items-center gap-1 text-xs font-bold text-white">
                <MessageSquare className="h-4 w-4 fill-white" /> {post.comment_count ?? 0}
              </span>
            </div>
          </button>
        ))}
      </div>
      {selectedPostId && (() => {
        const selectedPost = posts.find((p) => p.id === selectedPostId);
        if (!selectedPost) return null;
        return (
          <PostDetailDialog
            post={selectedPost as any}
            currentUserId={currentUserId}
            isSignedIn={!!currentUserId}
            open={!!selectedPostId}
            onOpenChange={(open) => !open && setSelectedPostId(null)}
          />
        );
      })()}
    </>
  );
}

function TransformationGallery({ p }: { p: any }) {
  const [active, setActive] = useState<number | null>(null);
  const total = p.transformations.length;

  const close = useCallback(() => setActive(null), []);
  const prev = useCallback(
    () => setActive((i) => (i === null ? i : (i - 1 + total) % total)),
    [total],
  );
  const next = useCallback(
    () => setActive((i) => (i === null ? i : (i + 1) % total)),
    [total],
  );

  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, prev, next]);

  if (p.transformation_visibility !== "public") {
    return <EmptyBlock text="This athlete keeps their transformation timeline private." />;
  }
  if (p.transformations.length === 0) {
    return <EmptyBlock text="No transformation entries yet." />;
  }

  const activeEntry = active !== null ? p.transformations[active] : null;
  const activeDate = activeEntry
    ? new Date(activeEntry.captured_on).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <>
      <ul
        role="list"
        aria-label="Transformation entries"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4"
      >
        {p.transformations.map((t: any, i: number) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => setActive(i)}
              className="group relative block aspect-[4/5] w-full overflow-hidden rounded-xl bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={`Open ${t.view_angle} view transformation entry from ${new Date(t.captured_on).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}${t.kind === "video" ? " (video)" : ""}`}
              aria-haspopup="dialog"
            >
            {t.kind === "video" ? (
              <video
                src={t.media_url}
                muted
                loop
                playsInline
                aria-hidden="true"
                tabIndex={-1}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <LazyImage
                src={t.thumbnail_url ?? t.media_url}
                alt={t.notes || "Transformation thumbnail"}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            )}
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-90" />
            {t.kind === "video" && (
              <div aria-hidden="true" className="absolute right-2 top-2 rounded-full bg-background/80 p-1.5 backdrop-blur">
                <Play className="h-3 w-3" />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3 text-left">
              <div>
                <p className="font-display text-sm uppercase tracking-wider text-white">
                  {new Date(t.captured_on).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                {t.weight_kg && (
                  <p className="text-[11px] font-medium text-white/95 [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">
                    {t.weight_kg} kg
                  </p>
                )}
              </div>
              <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white ring-1 ring-white/20 backdrop-blur">
                {t.view_angle}
              </span>
            </div>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={active !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent
          aria-label={activeEntry ? `Transformation entry — ${activeDate}` : "Transformation entry"}
          className="grid max-h-[92vh] w-[95vw] max-w-4xl gap-0 overflow-hidden border border-border bg-card p-0 sm:grid-cols-[minmax(0,1fr)_320px]"
        >
          <VisuallyHidden>
            <DialogTitle>{activeEntry ? `Transformation entry — ${activeDate}` : "Transformation entry"}</DialogTitle>
            <DialogDescription>
              {activeEntry
                ? `${activeEntry.view_angle} view captured on ${activeDate}. Use left and right arrow keys to navigate entries.`
                : ""}
            </DialogDescription>
          </VisuallyHidden>

          {activeEntry && (
            <>
              <div className="relative bg-black">
                {activeEntry.kind === "video" ? (
                  <video
                    key={activeEntry.id}
                    src={activeEntry.media_url}
                    controls
                    autoPlay
                    aria-label={`Transformation video from ${activeDate}`}
                    className="max-h-[92vh] w-full object-contain"
                  />
                ) : (
                  <LazyImage
                    key={activeEntry.id}
                    src={activeEntry.media_url}
                    alt={activeEntry.notes ?? `${activeEntry.view_angle} view transformation photo from ${activeDate}`}
                    objectFit="contain"
                    className="max-h-[92vh] w-full"
                  />
                )}

                {total > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={prev}
                      aria-label="Previous entry"
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground shadow backdrop-blur transition hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={next}
                      aria-label="Next entry"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground shadow backdrop-blur transition hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
              <div className="flex flex-col gap-3 p-5">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {activeEntry.view_angle} view
                </p>
                <p className="font-display text-lg uppercase">{activeDate}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {activeEntry.weight_kg && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Weight</p>
                      <p className="font-semibold">{activeEntry.weight_kg} kg</p>
                    </div>
                  )}
                  {activeEntry.body_fat_percent && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Body fat</p>
                      <p className="font-semibold">{activeEntry.body_fat_percent}%</p>
                    </div>
                  )}
                </div>
                {activeEntry.notes && (
                  <p className="mt-2 whitespace-pre-line text-sm text-foreground">
                    {activeEntry.notes}
                  </p>
                )}
                <div aria-live="polite" className="sr-only">
                  {`Entry ${(active ?? 0) + 1} of ${total}`}
                </div>
                <DialogClose asChild>
                  <Button variant="outline" size="sm" className="mt-auto gap-2">
                    <X className="h-4 w-4" /> Close
                  </Button>
                </DialogClose>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TraineeError({ error }: { error: Error }) {
  const isHtml = error?.message?.includes("<html") || error?.message?.includes("<!doctype");
  const cleanMsg = isHtml
    ? "Unable to connect to the server. Please try again."
    : error?.message || "Something went wrong.";
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 text-center">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-2xl uppercase">Profile unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{cleanMsg}</p>
        <Link to="/" className="mt-4 inline-block text-sm font-semibold underline">
          Back home
        </Link>
      </div>
    </div>
  );
}

function TraineeNotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 text-center">
      <div>
        <h1 className="font-display text-2xl uppercase">No such athlete</h1>
        <Link to="/" className="mt-4 inline-block text-sm underline">
          Back home
        </Link>
      </div>
    </div>
  );
}

type EditFormState = {
  display_name: string;
  bio: string;
  goal: string;
  personal_records: string;
  height_cm: string;
  weight_kg: string;
  body_fat_percent: string;
  skeletal_muscle_kg: string;
  social_links: string[];
};

function toForm(p: any): EditFormState {
  return {
    display_name: p.display_name ?? "",
    bio: p.bio ?? "",
    goal: p.goal ?? "",
    personal_records: p.personal_records ?? "",
    height_cm: p.height_cm != null ? String(p.height_cm) : "",
    weight_kg: p.weight_kg != null ? String(p.weight_kg) : "",
    body_fat_percent: p.body_fat_percent != null ? String(p.body_fat_percent) : "",
    skeletal_muscle_kg: p.skeletal_muscle_kg != null ? String(p.skeletal_muscle_kg) : "",
    social_links: Array.isArray(p.social_links) ? [...p.social_links] : [],
  };
}

function validate(form: EditFormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.display_name.trim()) errors.display_name = "Name is required";
  else if (form.display_name.length > 80) errors.display_name = "Max 80 characters";
  if (form.bio.length > 500) errors.bio = "Max 500 characters";
  if (form.goal.length > 200) errors.goal = "Max 200 characters";
  if (form.personal_records.length > 2000) errors.personal_records = "Max 2000 characters";

  const numRule = (
    key: keyof EditFormState,
    label: string,
    min: number,
    max: number,
  ) => {
    const raw = form[key] as string;
    if (!raw.trim()) return;
    const n = Number(raw);
    if (!Number.isFinite(n)) errors[key] = `${label} must be a number`;
    else if (n < min || n > max) errors[key] = `${label} must be between ${min} and ${max}`;
  };
  numRule("height_cm", "Height", 1, 300);
  numRule("weight_kg", "Weight", 1, 500);
  numRule("body_fat_percent", "Body fat", 1, 70);
  numRule("skeletal_muscle_kg", "Muscle", 1, 200);

  form.social_links.forEach((link, i) => {
    if (!link.trim()) return;
    try {
      const u = new URL(link);
      if (!/^https?:$/.test(u.protocol)) errors[`link_${i}`] = "Must start with http(s)://";
      else if (link.length > 300) errors[`link_${i}`] = "Max 300 characters";
    } catch {
      errors[`link_${i}`] = "Enter a valid URL";
    }
  });
  return errors;
}

function EditProfileDialog({
  open,
  onOpenChange,
  profile,
  username,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profile: any;
  username: string;
}) {
  const qc = useQueryClient();
  const update = useServerFn(updateTraineeProfile);
  const [form, setForm] = useState<EditFormState>(() => toForm(profile));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toForm(profile));
      setErrors({});
    }
  }, [open, profile]);

  const set = <K extends keyof EditFormState>(key: K, value: EditFormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const parseNum = (raw: string) => (raw.trim() === "" ? null : Number(raw));

  const handleSave = async () => {
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setSaving(true);
    try {
      await update({
        data: {
          display_name: form.display_name.trim(),
          bio: form.bio.trim() || null,
          goal: form.goal.trim() || null,
          personal_records: form.personal_records.trim() || null,
          height_cm: parseNum(form.height_cm),
          weight_kg: parseNum(form.weight_kg),
          body_fat_percent: parseNum(form.body_fat_percent),
          skeletal_muscle_kg: parseNum(form.skeletal_muscle_kg),
          social_links: form.social_links.map((l) => l.trim()).filter(Boolean),
        },
      });
      await qc.invalidateQueries({ queryKey: ["trainee-profile", username] });
      toast.success("Profile updated");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (saving ? undefined : onOpenChange(o))}>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-tight">
            Edit profile
          </DialogTitle>
          <DialogDescription>
            Update your bio, links, and stats. Changes are saved to your athlete profile.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          <FieldGroup title="Identity">
            <Field label="Display name" error={errors.display_name} htmlFor="edit-display-name" required>
              <Input
                id="edit-display-name"
                value={form.display_name}
                maxLength={80}
                onChange={(e) => set("display_name", e.target.value)}
                aria-invalid={!!errors.display_name}
              />
            </Field>
            <Field label="Bio" error={errors.bio} hint={`${form.bio.length}/500`} htmlFor="edit-bio">
              <Textarea
                id="edit-bio"
                value={form.bio}
                maxLength={500}
                rows={4}
                onChange={(e) => set("bio", e.target.value)}
                aria-invalid={!!errors.bio}
              />
            </Field>
            <Field label="Current goal" error={errors.goal} hint={`${form.goal.length}/200`} htmlFor="edit-goal">
              <Input
                id="edit-goal"
                value={form.goal}
                maxLength={200}
                onChange={(e) => set("goal", e.target.value)}
                aria-invalid={!!errors.goal}
              />
            </Field>
          </FieldGroup>

          <FieldGroup title="Links">
            <div className="space-y-2">
              {form.social_links.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Add links to your website, Instagram, YouTube, Strava, and more.
                </p>
              )}
              {form.social_links.map((link, i) => (
                <div key={i}>
                  <div className="flex items-center gap-2">
                    <Input
                      value={link}
                      placeholder="https://instagram.com/yourhandle"
                      onChange={(e) => {
                        const next = [...form.social_links];
                        next[i] = e.target.value;
                        set("social_links", next);
                      }}
                      aria-invalid={!!errors[`link_${i}`]}
                      aria-label={`Link ${i + 1}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Remove link ${i + 1}`}
                      onClick={() =>
                        set(
                          "social_links",
                          form.social_links.filter((_, j) => j !== i),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {errors[`link_${i}`] && (
                    <p className="mt-1 text-xs text-destructive">{errors[`link_${i}`]}</p>
                  )}
                </div>
              ))}
              {form.social_links.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => set("social_links", [...form.social_links, ""])}
                >
                  <Plus className="h-4 w-4" /> Add link
                </Button>
              )}
            </div>
          </FieldGroup>

          <FieldGroup title="Stats">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Height (cm)" error={errors.height_cm} htmlFor="edit-height">
                <Input
                  id="edit-height"
                  inputMode="decimal"
                  value={form.height_cm}
                  onChange={(e) => set("height_cm", e.target.value)}
                  aria-invalid={!!errors.height_cm}
                />
              </Field>
              <Field label="Weight (kg)" error={errors.weight_kg} htmlFor="edit-weight">
                <Input
                  id="edit-weight"
                  inputMode="decimal"
                  value={form.weight_kg}
                  onChange={(e) => set("weight_kg", e.target.value)}
                  aria-invalid={!!errors.weight_kg}
                />
              </Field>
              <Field label="Body fat %" error={errors.body_fat_percent} htmlFor="edit-bf">
                <Input
                  id="edit-bf"
                  inputMode="decimal"
                  value={form.body_fat_percent}
                  onChange={(e) => set("body_fat_percent", e.target.value)}
                  aria-invalid={!!errors.body_fat_percent}
                />
              </Field>
              <Field label="Muscle (kg)" error={errors.skeletal_muscle_kg} htmlFor="edit-muscle">
                <Input
                  id="edit-muscle"
                  inputMode="decimal"
                  value={form.skeletal_muscle_kg}
                  onChange={(e) => set("skeletal_muscle_kg", e.target.value)}
                  aria-invalid={!!errors.skeletal_muscle_kg}
                />
              </Field>
            </div>
            <Field
              label="Personal records"
              error={errors.personal_records}
              hint={`${form.personal_records.length}/2000`}
              htmlFor="edit-pr"
            >
              <Textarea
                id="edit-pr"
                value={form.personal_records}
                maxLength={2000}
                rows={4}
                placeholder={"Squat 1RM — 140kg\nBench 1RM — 100kg"}
                onChange={(e) => set("personal_records", e.target.value)}
                aria-invalid={!!errors.personal_records}
              />
            </Field>
          </FieldGroup>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-border bg-card/40 p-4">
      <legend className="px-1 font-display text-xs uppercase tracking-widest text-muted-foreground">
        {title}
      </legend>
      <div className="mt-2 space-y-3">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-widest">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}