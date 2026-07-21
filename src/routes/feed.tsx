import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  BadgeCheck,
  Heart,
  Bookmark,
  Lock,
  Play,
  Sparkles,
  Image as ImageIcon,
  Video,
  LayoutGrid,
  ArrowUpRight,
  AlertTriangle,
  RefreshCw,
  Share2,
  Loader2,
  Check,
  BadgeCheck as BadgeCheckIcon,
  UserCircle2,
  Search as SearchIcon,
  X as XIcon,
  Users,
  UserPlus,
  UserCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { getDiscoveryFeed } from "@/lib/trainer-functions";
import {
  toggleRespect,
  toggleSave,
  logShare,
  getViewerEngagementBatch,
} from "@/lib/engagement-functions";
import { toggleFollow, getFollowingIds } from "@/lib/subscription-functions";
import { cn } from "@/lib/utils";
import { ResponsiveImage } from "@/components/responsive-image";
import { PostDetailDialog } from "@/components/post-detail-dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Clock, MessageCircle } from "lucide-react";

const feedQuery = queryOptions({
  queryKey: ["discovery-feed"],
  queryFn: () => getDiscoveryFeed(),
});

const feedSearchSchema = z.object({
  tab: fallback(z.string(), "all").default("all"),
  post: fallback(z.string(), "").default(""),
  panel: fallback(z.string(), "media").default("media"),
  sort: fallback(z.string(), "newest").default("newest"),
  verified: fallback(z.string(), "all").default("all"),
  q: fallback(z.string(), "").default(""),
  scope: fallback(z.string(), "all").default("all"),
});
type FeedSearch = z.infer<typeof feedSearchSchema>;

export const Route = createFileRoute("/feed")({
  loader: ({ context }) => context.queryClient.ensureQueryData(feedQuery),
  validateSearch: zodValidator(feedSearchSchema),
  head: () => ({
    meta: [
      { title: "Discover — LEER Sports" },
      {
        name: "description",
        content:
          "Explore fitness content from verified elite trainers worldwide on LEER Sports.",
      },
      { property: "og:title", content: "Discover — LEER Sports" },
      {
        property: "og:description",
        content: "Explore fitness content from verified elite trainers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FeedPage,
  pendingComponent: FeedSkeleton,
  pendingMs: 200,
  pendingMinMs: 400,
  errorComponent: ({ error }) => <FeedError error={error} />,
  notFoundComponent: () => <FeedError error={new Error("Feed not found.")} />,
});

type FilterKind = "all" | "feed" | "short";

function FeedPage() {
  const { data: allPosts } = useSuspenseQuery(feedQuery);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/feed" });

  const kind: FilterKind =
    search.tab === "feed" || search.tab === "short" ? search.tab : "all";
  const openId = search.post ? search.post : null;
  const panel: "media" | "comments" =
    search.panel === "comments" ? "comments" : "media";
  const commentSort: "newest" | "oldest" =
    search.sort === "oldest" ? "oldest" : "newest";
  const verified: "all" | "verified" | "unverified" =
    search.verified === "verified"
      ? "verified"
      : search.verified === "unverified"
        ? "unverified"
        : "all";
  const q = search.q ?? "";
  const scope: "all" | "following" =
    search.scope === "following" ? "following" : "all";

  const setKind = useCallback(
    (next: FilterKind) => {
      void navigate({
        search: (prev: FeedSearch) => ({
          ...prev,
          tab: next,
          // closing modal on tab switch keeps behavior predictable
          post: "",
        }),
        replace: true,
        resetScroll: false,
      });
    },
    [navigate],
  );
  const setOpenId = useCallback(
    (next: string | null) => {
      void navigate({
        search: (prev: FeedSearch) => ({
          ...prev,
          post: next ?? "",
          // Reset panel when opening a different (or closing) post so each
          // post starts on its default panel unless explicitly deep-linked.
          panel: next && next === prev.post ? prev.panel : "media",
        }),
        replace: false,
        resetScroll: false,
      });
    },
    [navigate],
  );
  const setPanel = useCallback(
    (next: "media" | "comments") => {
      void navigate({
        search: (prev: FeedSearch) => ({ ...prev, panel: next }),
        // Push a new history entry so back/forward walks panel changes.
        // The dialog stays open as long as `post` is present in the URL,
        // so navigating back to a prior panel does not close it.
        replace: false,
        resetScroll: false,
      });
    },
    [navigate],
  );
  const setCommentSort = useCallback(
    (next: "newest" | "oldest") => {
      void navigate({
        search: (prev: FeedSearch) => ({ ...prev, sort: next }),
        replace: true,
        resetScroll: false,
      });
    },
    [navigate],
  );
  const setVerified = useCallback(
    (next: "all" | "verified" | "unverified") => {
      void navigate({
        search: (prev: FeedSearch) => ({ ...prev, verified: next, post: "" }),
        replace: true,
        resetScroll: false,
      });
    },
    [navigate],
  );
  const setScope = useCallback(
    (next: "all" | "following") => {
      void navigate({
        search: (prev: FeedSearch) => ({ ...prev, scope: next, post: "" }),
        replace: true,
        resetScroll: false,
      });
    },
    [navigate],
  );

  // Local input state kept in sync with the URL, debounced into `?q=`.
  const [queryInput, setQueryInput] = useState(q);
  useEffect(() => {
    setQueryInput(q);
  }, [q]);
  useEffect(() => {
    const next = queryInput.trim();
    if (next === (q ?? "").trim()) return;
    const t = setTimeout(() => {
      void navigate({
        search: (prev: FeedSearch) => ({ ...prev, q: next, post: "" }),
        replace: true,
        resetScroll: false,
      });
    }, 200);
    return () => clearTimeout(t);
  }, [queryInput, q, navigate]);
  const [userId, setUserId] = useState<string | null>(null);
  const signedIn = !!userId;

  const qc = useQueryClient();
  const followingIdsFn = useServerFn(getFollowingIds);
  const { data: followingIds = [] } = useQuery({
    queryKey: ["following-ids", userId],
    queryFn: () => followingIdsFn(),
    enabled: !!userId,
    staleTime: 30_000,
  });
  const followingSet = useMemo(() => new Set(followingIds), [followingIds]);

  // Viewer engagement (liked/saved) for currently visible posts.
  const viewerEngagementFn = useServerFn(getViewerEngagementBatch);
  const visiblePostIds = useMemo(
    () => allPosts.map((p) => p.id),
    [allPosts],
  );
  const { data: viewerEng } = useQuery({
    queryKey: ["viewer-engagement", userId, visiblePostIds.length],
    queryFn: () => viewerEngagementFn({ data: { postIds: visiblePostIds } }),
    enabled: !!userId && visiblePostIds.length > 0,
    staleTime: 30_000,
  });
  const likedSet = useMemo(
    () => new Set(viewerEng?.liked ?? []),
    [viewerEng],
  );
  const savedSet = useMemo(
    () => new Set(viewerEng?.saved ?? []),
    [viewerEng],
  );

  const openComments = useCallback(
    (postId: string) => {
      void navigate({
        search: (prev: FeedSearch) => ({
          ...prev,
          post: postId,
          panel: "comments",
        }),
        replace: false,
        resetScroll: false,
      });
    },
    [navigate],
  );

  const followFn = useServerFn(toggleFollow);
  const followMut = useMutation({
    mutationFn: (trainerId: string) => followFn({ data: { trainerId } }),
    onMutate: async (trainerId: string) => {
      await qc.cancelQueries({ queryKey: ["following-ids", userId] });
      const prev = qc.getQueryData<string[]>(["following-ids", userId]) ?? [];
      const next = prev.includes(trainerId)
        ? prev.filter((id) => id !== trainerId)
        : [...prev, trainerId];
      qc.setQueryData(["following-ids", userId], next);
      return { prev };
    },
    onError: (err: Error, _trainerId, ctx) => {
      if (ctx?.prev) qc.setQueryData(["following-ids", userId], ctx.prev);
      toast.error(
        err.message.includes("Unauthorized") ? "Sign in to follow" : "Couldn't update follow",
      );
    },
    onSuccess: (res, trainerId) => {
      toast.success(res.following ? "Following" : "Unfollowed");
      const cur = qc.getQueryData<string[]>(["following-ids", userId]) ?? [];
      const contains = cur.includes(trainerId);
      if (res.following !== contains) {
        qc.setQueryData(
          ["following-ids", userId],
          res.following ? [...cur, trainerId] : cur.filter((id) => id !== trainerId),
        );
      }
    },
  });

  // Registry of tile buttons so we can restore focus to whichever post is
  // currently visible when the modal closes (may differ from the initially
  // clicked tile after prev/next navigation).
  const tileRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const registerTile = useCallback(
    (id: string, el: HTMLButtonElement | null) => {
      if (el) tileRefs.current.set(id, el);
      else tileRefs.current.delete(id);
    },
    [],
  );
  const openIdRef = useRef<string | null>(null);
  useEffect(() => {
    openIdRef.current = openId;
  }, [openId]);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const posts = useMemo(
    () => {
      const byKind = kind === "all" ? allPosts : allPosts.filter((p) => p.kind === kind);
      const byVerified =
        verified === "verified"
          ? byKind.filter((p) => p.trainer.is_verified)
          : verified === "unverified"
            ? byKind.filter((p) => !p.trainer.is_verified)
            : byKind;
      const byScope =
        scope === "following"
          ? byVerified.filter((p) => followingSet.has(p.trainer.user_id))
          : byVerified;
      const needle = q.trim().toLowerCase();
      if (!needle) return byScope;
      return byScope.filter((p) => {
        const t = p.trainer;
        return (
          (p.caption ?? "").toLowerCase().includes(needle) ||
          (t.display_name ?? "").toLowerCase().includes(needle) ||
          (t.username ?? "").toLowerCase().includes(needle)
        );
      });
    },
    [allPosts, kind, verified, q, scope, followingSet],
  );

  const counts = useMemo(
    () => ({
      all: allPosts.length,
      feed: allPosts.filter((p) => p.kind === "feed").length,
      short: allPosts.filter((p) => p.kind === "short").length,
    }),
    [allPosts],
  );

  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [kind, verified, scope, q]);
  const visiblePosts = useMemo(
    () => posts.slice(0, visibleCount),
    [posts, visibleCount],
  );
  const hasMore = visibleCount < posts.length;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, posts.length));
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, posts.length]);

  const tabs: { id: FilterKind; label: string; Icon: typeof LayoutGrid; count: number }[] = [
    { id: "all", label: "All", Icon: LayoutGrid, count: counts.all },
    { id: "feed", label: "Photos", Icon: ImageIcon, count: counts.feed },
    { id: "short", label: "Videos", Icon: Video, count: counts.short },
  ];

  const verifiedCounts = useMemo(() => {
    const scoped = kind === "all" ? allPosts : allPosts.filter((p) => p.kind === kind);
    const v = scoped.filter((p) => p.trainer.is_verified).length;
    return { all: scoped.length, verified: v, unverified: scoped.length - v };
  }, [allPosts, kind]);

  const verifiedTabs: {
    id: "all" | "verified" | "unverified";
    label: string;
    Icon: typeof LayoutGrid;
    count: number;
  }[] = [
    { id: "all", label: "Everyone", Icon: LayoutGrid, count: verifiedCounts.all },
    { id: "verified", label: "Verified", Icon: BadgeCheckIcon, count: verifiedCounts.verified },
    { id: "unverified", label: "Community", Icon: UserCircle2, count: verifiedCounts.unverified },
  ];

  return (
    <div className="relative min-h-dvh bg-background">
      {/* Ambient background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] opacity-70 [background:radial-gradient(60%_60%_at_20%_10%,color-mix(in_oklab,var(--primary)_28%,transparent),transparent_60%),radial-gradient(50%_50%_at_90%_0%,color-mix(in_oklab,var(--accent)_25%,transparent),transparent_60%)]"
      />

      <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12 lg:px-8 lg:pt-14">
        {/* Hero header */}
        <header className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-2.5 py-1 font-display text-[10px] uppercase tracking-[0.3em] text-primary backdrop-blur">
                <Sparkles className="h-3 w-3" /> Community feed
              </span>
              <h1 className="mt-3 font-display text-4xl uppercase leading-none tracking-tight sm:text-6xl">
                Real athletes.{" "}
                <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                  Real uploads.
                </span>
              </h1>
              <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
                Fresh content posted by our verified trainers — no demo fluff,
                just real training moments as they happen.
              </p>
            </div>
            <Link
              to="/shorts"
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 font-display text-xs uppercase tracking-widest text-foreground backdrop-blur transition-all hover:border-primary/60 hover:bg-primary/10"
            >
              Shorts
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Search */}
          <div className="mt-8 max-w-xl">
            <label htmlFor="feed-search" className="sr-only">
              Search posts
            </label>
            <div className="group relative">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
              />
              <input
                id="feed-search"
                type="search"
                autoComplete="off"
                spellCheck={false}
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Search athletes, trainers, or captions"
                className="h-11 w-full rounded-full border border-border bg-card/60 pl-11 pr-11 text-sm text-foreground placeholder:text-muted-foreground/70 backdrop-blur transition-all focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
              />
              {queryInput ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQueryInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Filter tabs */}
          <div
            role="tablist"
            aria-label="Filter feed"
            className="mt-4 flex w-full flex-wrap gap-1.5 rounded-full border border-border bg-card/60 p-1 backdrop-blur sm:w-auto sm:inline-flex"
          >
            {tabs.map(({ id, label, Icon, count }) => {
              const active = kind === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setKind(id)}
                  className={cn(
                    "group inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex-none",
                    active
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                      active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Verified filter */}
          <div
            role="tablist"
            aria-label="Filter by author verification"
            className="mt-3 flex w-full flex-wrap gap-1.5 rounded-full border border-border bg-card/60 p-1 backdrop-blur sm:w-auto sm:inline-flex"
          >
            {verifiedTabs.map(({ id, label, Icon, count }) => {
              const active = verified === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setVerified(id)}
                  className={cn(
                    "group inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex-none",
                    active
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                      active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Following-only toggle */}
          {signedIn && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 p-1 backdrop-blur">
              <button
                type="button"
                role="switch"
                aria-checked={scope === "following"}
                onClick={() => setScope(scope === "following" ? "all" : "following")}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  scope === "following"
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Following only</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    scope === "following"
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {followingIds.length}
                </span>
              </button>
            </div>
          )}
        </header>

        {/* Grid */}
        <section className="mt-10">
          {posts.length === 0 ? (
            <EmptyState kind={kind} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6">
              {visiblePosts.map((p, i) => (
                <FeedTile
                  key={p.id}
                  p={p}
                  index={i}
                  onOpen={() => setOpenId(p.id)}
                  onOpenComments={() => openComments(p.id)}
                  registerRef={(el) => registerTile(p.id, el)}
                  signedIn={signedIn}
                  initialLiked={likedSet.has(p.id)}
                  initialSaved={savedSet.has(p.id)}
                  isFollowing={followingSet.has(p.trainer.user_id)}
                  canFollow={signedIn && userId !== p.trainer.user_id}
                  followPending={
                    followMut.isPending && followMut.variables === p.trainer.user_id
                  }
                  onToggleFollow={() => {
                    if (!signedIn) {
                      toast.error("Sign in to follow");
                      return;
                    }
                    if (!followMut.isPending) followMut.mutate(p.trainer.user_id);
                  }}
                />
              ))}
            </div>
          )}
          {posts.length > 0 && hasMore ? (
            <div className="mt-8 flex flex-col items-center gap-3">
              <div ref={sentinelRef} aria-hidden className="h-1 w-full" />
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((c) => Math.min(c + PAGE_SIZE, posts.length))
                }
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-5 py-2 text-sm font-medium backdrop-blur transition hover:bg-background"
              >
                <Loader2 className="h-4 w-4 opacity-70" aria-hidden />
                Load more
                <span className="text-xs text-muted-foreground">
                  ({posts.length - visibleCount} left)
                </span>
              </button>
            </div>
          ) : posts.length > 0 ? (
            <p className="mt-8 text-center text-xs text-muted-foreground">
              You've reached the end · {posts.length} posts
            </p>
          ) : null}
        </section>
      </div>

      {openId ? (
        (() => {
          const idx = posts.findIndex((x) => x.id === openId);
          const post = idx >= 0 ? posts[idx] : allPosts.find((x) => x.id === openId);
          if (!post) return null;
          const prev = idx > 0 ? posts[idx - 1] : null;
          const next = idx >= 0 && idx < posts.length - 1 ? posts[idx + 1] : null;
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
              onPrev={prev ? () => setOpenId(prev.id) : undefined}
              onNext={next ? () => setOpenId(next.id) : undefined}
              onCloseAutoFocus={(event) => {
                const target =
                  openIdRef.current && tileRefs.current.get(openIdRef.current);
                if (target) {
                  event.preventDefault();
                  // Radix will otherwise focus the previously-focused element
                  // captured at open time; we want the tile matching the last
                  // viewed post.
                  requestAnimationFrame(() => target.focus());
                }
              }}
            />
          );
        })()
      ) : null}
    </div>
  );
}

function FeedTile({
  p,
  index,
  onOpen,
  onOpenComments,
  registerRef,
  signedIn,
  initialLiked,
  initialSaved,
  isFollowing,
  canFollow,
  followPending,
  onToggleFollow,
}: {
  p: Awaited<ReturnType<typeof getDiscoveryFeed>>[number];
  index: number;
  onOpen: () => void;
  onOpenComments: () => void;
  registerRef?: (el: HTMLButtonElement | null) => void;
  signedIn: boolean;
  initialLiked: boolean;
  initialSaved: boolean;
  isFollowing: boolean;
  canFollow: boolean;
  followPending: boolean;
  onToggleFollow: () => void;
}) {
  const thumb = p.thumbnail_url ?? p.media_url;
  const trainerHref = p.trainer.username ?? p.trainer.user_id;
  const isVideo = p.kind === "short";
  const delay = Math.min(index * 40, 480);

  // Lifted engagement state so the tile footer counts stay in sync with
  // the QuickActions optimistic toggles.
  const [liked, setLiked] = useState<boolean>(initialLiked);
  const [saved, setSaved] = useState<boolean>(initialSaved);
  useEffect(() => setLiked(initialLiked), [initialLiked]);
  useEffect(() => setSaved(initialSaved), [initialSaved]);
  const respectDelta = (liked ? 1 : 0) - (initialLiked ? 1 : 0);
  const saveDelta = (saved ? 1 : 0) - (initialSaved ? 1 : 0);
  const respectCount = Math.max(0, p.respect_count + respectDelta);
  const saveCount = Math.max(0, p.save_count + saveDelta);

  return (
    <HoverCard openDelay={220} closeDelay={120}>
      <HoverCardTrigger asChild>
        <div
          style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
          className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-lg shadow-black/20 ring-1 ring-white/5 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20 hover:ring-primary/30 animate-in fade-in slide-in-from-bottom-3 sm:aspect-[3/4] lg:aspect-[4/5] xl:aspect-[3/4]"
        >
      <Link
        to="/posts/$postId"
        params={{ postId: p.id }}
        aria-label={`Open post${p.caption ? `: ${p.caption.slice(0, 60)}` : ""}`}
        className="absolute inset-0 z-0 cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />
      {thumb ? (
        <ResponsiveImage
          src={thumb}
          variant="thumb"
          seed={p.id}
          sizes="(min-width: 1280px) 420px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          alt={p.caption ?? ""}
          className={cn(
            "pointer-events-none h-full w-full object-cover transition-transform duration-[700ms] ease-out group-hover:scale-[1.08]",
            p.is_premium && "locked-blur",
          )}
        />
      ) : (
        <div className="pointer-events-none h-full w-full bg-gradient-to-br from-card via-muted to-card" />
      )}

      {/* Media type badge */}
      {isVideo && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white ring-1 ring-white/20 backdrop-blur-md"
        >
          <Play className="h-3 w-3 fill-current" /> Reel
        </div>
      )}

      {/* Quick actions */}
      <QuickActions
        post={p}
        signedIn={signedIn}
        liked={liked}
        saved={saved}
        setLiked={setLiked}
        setSaved={setSaved}
        onOpenComments={onOpenComments}
        isFollowing={isFollowing}
        canFollow={canFollow}
        followPending={followPending}
        onToggleFollow={onToggleFollow}
      />

      {/* Premium overlay */}
      {p.is_premium && (
        <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center bg-background/50 backdrop-blur-[2px]">
          <div className="rounded-full border border-primary/40 bg-primary/10 p-3.5">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <span className="mt-2.5 font-display text-xs uppercase tracking-[0.3em] text-primary">
            Premium
          </span>
        </div>
      )}

      {/* Bottom gradient + meta */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/95 via-black/55 to-transparent opacity-95 transition-opacity duration-300 group-hover:opacity-100"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 sm:p-5">
        {p.caption ? (
          <p className="pointer-events-none line-clamp-2 text-sm font-medium leading-snug text-white/95 drop-shadow-sm sm:text-[15px]">
            {p.caption}
          </p>
        ) : null}
        <div className="flex items-end justify-between gap-2">
        <Link
          to="/trainers/$username"
          params={{ username: trainerHref }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`View ${p.trainer.display_name ?? p.trainer.username ?? "trainer"} profile`}
          className="pointer-events-auto relative z-10 flex min-w-0 items-center gap-2.5 rounded-full pr-2 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-white/20 shadow-lg shadow-black/40">
            {p.trainer.avatar_url ? (
              <img
                src={p.trainer.avatar_url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary/40 to-accent/40" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="truncate text-sm font-semibold text-white">
                {p.trainer.display_name ?? p.trainer.username}
              </span>
              {p.trainer.is_verified && (
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
              )}
            </div>
            {p.trainer.username ? (
              <span className="block truncate text-[11px] font-medium text-white/60">
                @{p.trainer.username}
              </span>
            ) : null}
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-white/95">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 ring-1 ring-white/10 backdrop-blur">
            <Heart className={cn("h-3.5 w-3.5", liked && "fill-current text-primary")} />
            {formatCount(respectCount)}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onOpenComments();
            }}
            aria-label="View comments"
            className="pointer-events-auto z-10 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 ring-1 ring-white/10 backdrop-blur transition hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {formatCount(p.comment_count ?? 0)}
          </button>
          <span className="hidden items-center gap-1 rounded-full bg-black/55 px-2 py-1 ring-1 ring-white/10 backdrop-blur sm:inline-flex">
            <Bookmark className={cn("h-3.5 w-3.5", saved && "fill-current text-accent")} />
            {formatCount(saveCount)}
          </span>
        </div>
        </div>
          </div>
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="center"
        sideOffset={12}
        className="w-80 overflow-hidden rounded-2xl border-border/70 bg-card/95 p-0 shadow-2xl backdrop-blur-xl"
      >
        <PostHoverPreview post={p} />
      </HoverCardContent>
    </HoverCard>
  );
}

function PostHoverPreview({
  post,
}: {
  post: Awaited<ReturnType<typeof getDiscoveryFeed>>[number];
}) {
  const thumb = post.thumbnail_url ?? post.media_url;
  const trainerHref = post.trainer.username ?? post.trainer.user_id;
  const isVideo = post.kind === "short";
  return (
    <div className="flex flex-col">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className={cn(
              "h-full w-full object-cover",
              post.is_premium && "locked-blur",
            )}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/25 via-card to-accent/25" />
        )}
        <div className="absolute left-2 top-2 flex gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white ring-1 ring-white/15 backdrop-blur">
            {isVideo ? <Play className="h-2.5 w-2.5 fill-current" /> : null}
            {isVideo ? "Reel" : "Post"}
          </span>
          {post.is_premium ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
              <Lock className="h-2.5 w-2.5" /> Premium
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <Link
          to="/trainers/$username"
          params={{ username: trainerHref }}
          className="flex items-center gap-2.5 hover:opacity-90"
        >
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border">
            {post.trainer.avatar_url ? (
              <img
                src={post.trainer.avatar_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary/40 to-accent/40" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="truncate text-sm font-semibold text-foreground">
                {post.trainer.display_name ?? post.trainer.username}
              </span>
              {post.trainer.is_verified ? (
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
              ) : null}
            </div>
            {post.trainer.username ? (
              <span className="block truncate text-[11px] text-muted-foreground">
                @{post.trainer.username}
              </span>
            ) : null}
          </div>
        </Link>
        {post.caption ? (
          <p className="line-clamp-3 text-sm leading-snug text-foreground/90">
            {post.caption}
          </p>
        ) : (
          <p className="text-sm italic text-muted-foreground">No caption</p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-foreground">
              {formatCount(post.respect_count)}
            </span>
            respects
          </span>
          <span className="inline-flex items-center gap-1">
            <Bookmark className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">
              {formatCount(post.save_count)}
            </span>
            saves
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatRelative(post.created_at)}
          </span>
        </div>
        <Link
          to="/posts/$postId"
          params={{ postId: post.id }}
          className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          View full post
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(1, Math.floor(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

type FeedPost = Awaited<ReturnType<typeof getDiscoveryFeed>>[number];

function QuickActions({
  post,
  signedIn,
  liked,
  saved,
  setLiked,
  setSaved,
  onOpenComments,
  isFollowing,
  canFollow,
  followPending,
  onToggleFollow,
}: {
  post: FeedPost;
  signedIn: boolean;
  liked: boolean;
  saved: boolean;
  setLiked: React.Dispatch<React.SetStateAction<boolean>>;
  setSaved: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenComments: () => void;
  isFollowing: boolean;
  canFollow: boolean;
  followPending: boolean;
  onToggleFollow: () => void;
}) {
  const qc = useQueryClient();
  const respectFn = useServerFn(toggleRespect);
  const saveFn = useServerFn(toggleSave);
  const shareFn = useServerFn(logShare);

  const [shared, setShared] = useState(false);

  const stop = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const likeMut = useMutation({
    mutationFn: () => {
      if (!signedIn) throw new Error("Unauthorized");
      return respectFn({ data: { postId: post.id } });
    },
    onMutate: () => setLiked((v) => !v),
    onError: (err: Error) => {
      setLiked((v) => !v);
      toast.error(err.message.includes("Unauthorized") ? "Sign in to like posts" : "Couldn't update like");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["discovery-feed"] }),
  });

  const saveMut = useMutation({
    mutationFn: () => {
      if (!signedIn) throw new Error("Unauthorized");
      return saveFn({ data: { postId: post.id } });
    },
    onMutate: () => setSaved((v) => !v),
    onError: (err: Error) => {
      setSaved((v) => !v);
      toast.error(err.message.includes("Unauthorized") ? "Sign in to save posts" : "Couldn't update save");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["discovery-feed"] }),
  });

  const shareMut = useMutation({
    mutationFn: async () => {
      const url = `${window.location.origin}/trainers/${post.trainer.username ?? post.trainer.user_id}`;
      const title = post.caption ?? "Check this post on LEER Sports";
      const nav = typeof navigator !== "undefined" ? navigator : undefined;
      if (nav?.share) {
        try {
          await nav.share({ title, url });
        } catch {
          /* user cancelled */
          return { skipped: true } as const;
        }
      } else if (nav?.clipboard) {
        await nav.clipboard.writeText(url);
      }
      try {
        await shareFn({ data: { postId: post.id, channel: nav?.share ? "native" : "clipboard" } });
      } catch {
        /* not signed in — sharing still worked */
      }
      return { skipped: false } as const;
    },
    onSuccess: (res) => {
      if (res?.skipped) return;
      setShared(true);
      toast.success("Link copied");
      setTimeout(() => setShared(false), 1600);
    },
    onError: () => toast.error("Couldn't share post"),
  });

  return (
    <div
      className="absolute right-2 top-2 z-20 flex items-center gap-1.5 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
      onClick={stop}
    >
      <QuickActionButton
        label={liked ? "Unlike" : "Like"}
        active={liked}
        loading={likeMut.isPending}
        onClick={(e) => {
          stop(e);
          if (!likeMut.isPending) likeMut.mutate();
        }}
        activeClass="bg-primary text-primary-foreground"
      >
        <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} />
      </QuickActionButton>
      <QuickActionButton
        label="Comment"
        active={false}
        loading={false}
        onClick={(e) => {
          stop(e);
          onOpenComments();
        }}
        activeClass="bg-primary text-primary-foreground"
      >
        <MessageCircle className="h-3.5 w-3.5" />
      </QuickActionButton>
      <QuickActionButton
        label={saved ? "Unsave" : "Save"}
        active={saved}
        loading={saveMut.isPending}
        onClick={(e) => {
          stop(e);
          if (!saveMut.isPending) saveMut.mutate();
        }}
        activeClass="bg-accent text-accent-foreground"
      >
        <Bookmark className={cn("h-3.5 w-3.5", saved && "fill-current")} />
      </QuickActionButton>
      <QuickActionButton
        label="Share"
        active={shared}
        loading={shareMut.isPending}
        onClick={(e) => {
          stop(e);
          if (!shareMut.isPending) shareMut.mutate();
        }}
        activeClass="bg-emerald-500 text-white"
      >
        {shared ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
      </QuickActionButton>
      {canFollow && (
        <QuickActionButton
          label={isFollowing ? "Unfollow" : "Follow"}
          active={isFollowing}
          loading={followPending}
          onClick={(e) => {
            stop(e);
            onToggleFollow();
          }}
          activeClass="bg-primary text-primary-foreground"
        >
          {isFollowing ? (
            <UserCheck className="h-3.5 w-3.5" />
          ) : (
            <UserPlus className="h-3.5 w-3.5" />
          )}
        </QuickActionButton>
      )}
    </div>
  );
}

function QuickActionButton({
  label,
  active,
  loading,
  onClick,
  activeClass,
  children,
}: {
  label: string;
  active: boolean;
  loading: boolean;
  onClick: (e: React.MouseEvent) => void;
  activeClass: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      disabled={loading}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-white/15 backdrop-blur transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-90 disabled:opacity-70",
        active ? activeClass : "bg-black/55 text-white hover:bg-black/75",
      )}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </button>
  );
}

function EmptyState({ kind }: { kind: FilterKind }) {
  const navigate = useNavigate({ from: "/feed" });
  const search = Route.useSearch();
  const label =
    kind === "short" ? "video reels" : kind === "feed" ? "photo posts" : "posts";
  const hasFilters =
    !!search.q ||
    (search.verified && search.verified !== "all") ||
    (search.scope && search.scope !== "all") ||
    kind !== "all";
  const Icon = kind === "short" ? Video : kind === "feed" ? ImageIcon : Sparkles;
  return (
    <div
      role="status"
      aria-live="polite"
      className="relative overflow-hidden rounded-3xl border border-dashed border-border bg-card/50 px-6 py-14 text-center backdrop-blur-md animate-in fade-in zoom-in-95 duration-500 sm:px-12 sm:py-20"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(50%_60%_at_50%_0%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_70%)]"
      />
      <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40">
          <Icon className="h-7 w-7 text-primary" />
        </span>
      </div>
      <h2 className="font-display text-xl uppercase tracking-tight sm:text-2xl">
        {hasFilters ? "No matches found" : `No ${label} yet`}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
        {hasFilters
          ? "Try clearing filters or searching for a different keyword to widen the net."
          : `Our trainers haven't uploaded ${label} yet. Check back soon or explore featured content from around the world.`}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {hasFilters ? (
          <button
            type="button"
            onClick={() =>
              navigate({
                search: (prev: FeedSearch) => ({
                  ...prev,
                  q: "",
                  tab: "all",
                  verified: "all",
                  scope: "all",
                }),
              })
            }
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-display text-xs uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset filters
          </button>
        ) : null}
        <Link
          to="/explore"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-5 py-2 font-display text-xs uppercase tracking-widest text-foreground backdrop-blur transition-all hover:border-primary/60 hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Explore trainers <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="relative min-h-dvh bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] opacity-70 [background:radial-gradient(60%_60%_at_20%_10%,color-mix(in_oklab,var(--primary)_28%,transparent),transparent_60%),radial-gradient(50%_50%_at_90%_0%,color-mix(in_oklab,var(--accent)_25%,transparent),transparent_60%)]"
      />
      <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12 lg:px-8 lg:pt-14">
        {/* Header */}
        <div className="space-y-4">
          <div className="h-5 w-40 shimmer rounded-full" />
          <div className="h-10 w-3/4 shimmer rounded-lg sm:h-14" />
          <div className="h-4 w-2/3 shimmer rounded" />
        </div>
        {/* Filter chips */}
        <div className="mt-8 flex flex-wrap gap-2">
          {[96, 112, 88, 104].map((w, i) => (
            <div
              key={i}
              style={{ width: w }}
              className="h-9 shimmer rounded-full"
            />
          ))}
        </div>
        {/* Search bar */}
        <div className="mt-4 h-11 w-full max-w-xl shimmer rounded-full" />
        {/* Card grid */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <FeedCardSkeleton
              key={i}
              delayMs={Math.min(i * 70, 490)}
            />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes feedShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shimmer {
          background-image: linear-gradient(
            90deg,
            color-mix(in oklab, var(--muted) 80%, transparent) 0%,
            color-mix(in oklab, var(--card) 90%, transparent) 50%,
            color-mix(in oklab, var(--muted) 80%, transparent) 100%
          );
          background-size: 200% 100%;
          animation: feedShimmer 1.6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

function FeedCardSkeleton({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <div
      style={{ animationDelay: `${delayMs}ms` }}
      className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-lg shadow-black/10 animate-in fade-in slide-in-from-bottom-3 duration-500 sm:aspect-[3/4] lg:aspect-[4/5] xl:aspect-[3/4]"
    >
      <div className="absolute inset-0 shimmer" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
      {/* Top-right badge */}
      <div className="absolute right-3 top-3 h-6 w-14 rounded-full bg-black/40 backdrop-blur" />
      {/* Bottom info */}
      <div className="absolute inset-x-3 bottom-3 flex items-center gap-2.5">
        <div className="h-9 w-9 shrink-0 rounded-full bg-white/25 backdrop-blur" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-24 rounded-full bg-white/30" />
          <div className="h-2.5 w-3/4 rounded-full bg-white/20" />
        </div>
      </div>
    </div>
  );
}

function FeedError({ error }: { error: Error }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const handleRetry = async () => {
    setRetrying(true);
    try {
      await router.invalidate();
    } finally {
      setRetrying(false);
    }
  };
  return (
    <div className="relative min-h-dvh bg-background">
      <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/30">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="font-display text-2xl uppercase tracking-tight sm:text-3xl">
          Couldn&apos;t load the feed
        </h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {error?.message || "Something went wrong while fetching posts."} Give it another try — most hiccups clear on retry.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-display text-xs uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", retrying && "animate-spin")} />
            {retrying ? "Retrying" : "Try again"}
          </button>
          <Link
            to="/explore"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 font-display text-xs uppercase tracking-widest text-foreground backdrop-blur hover:border-primary/60 hover:bg-primary/10"
          >
            Explore trainers <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}