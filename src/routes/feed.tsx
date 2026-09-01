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
  LayoutGrid,
  Grid3x3,
  List,
  Image as ImageIcon,
  Video,
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
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import { LazyImage } from "@/components/ui/lazy-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { getDiscoveryFeed } from "@/lib/trainer-functions";
import { SignInBanner } from "@/components/sign-in-banner";
import { openAuthGate } from "@/lib/auth-gate";
import {
  toggleRespect,
  toggleSave,
  logShare,
  getViewerEngagementBatch,
} from "@/lib/engagement-functions";
import { toggleFollow, getFollowingIds } from "@/lib/subscription-functions";
import { deletePost, updatePost } from "@/lib/post-functions";
import { cn } from "@/lib/utils";
import { ResponsiveImage } from "@/components/responsive-image";
import { PostDetailDialog } from "@/components/post-detail-dialog";
import { ShareSheet } from "@/components/share-sheet";
import { InstaFeedCard } from "@/components/insta-feed-card";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Clock, MessageCircle } from "lucide-react";

const feedQuery = queryOptions({
  queryKey: ["discovery-feed"],
  queryFn: () => getDiscoveryFeed(),
  staleTime: 0, // always re-fetch on mount so auth token is included
});


const feedSearchSchema = z.object({
  tab: z.string().optional(),
  post: z.string().optional(),
  panel: z.string().optional(),
  sort: z.string().optional(),
  verified: z.string().optional(),
  q: z.string().optional(),
  scope: z.string().optional(),
});
type FeedSearch = z.infer<typeof feedSearchSchema>;

export const Route = createFileRoute("/feed")({
  loader: async ({ context: _context }) => {
    // Do NOT prefetch here: SSR runs without auth token (client-side
    // attachSupabaseAuth middleware does not run server-side), so
    // pre-populating the cache would lock all premium posts even for
    // subscribed users. The client will fetch on mount with staleTime:0.
  },
  validateSearch: zodValidator(feedSearchSchema),
  head: () => ({
    meta: [
      { title: "Discover — LEER Sports" },
      {
        name: "description",
        content:
          "Explore fitness content from verified elite creators worldwide on LEER Sports.",
      },
      { property: "og:title", content: "Discover — LEER Sports" },
      {
        property: "og:description",
        content: "Explore fitness content from verified elite creators.",
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
  const { data: allPostsData } = useQuery(feedQuery);
  const allPosts = allPostsData ?? [];
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
  const [layoutMode, setLayoutMode] = useState<"grid" | "tiles" | "list">("tiles");
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

  // Realtime: bump comment counts on visible posts when new comments arrive.
  const visibleIdSetRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    visibleIdSetRef.current = new Set(visiblePostIds);
  }, [visiblePostIds]);
  useEffect(() => {
    if (visiblePostIds.length === 0) return;
    const channel = supabase
      .channel("feed-comments-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments" },
        (payload) => {
          const row = payload.new as {
            post_id?: string;
            status?: string;
          } | null;
          if (!row?.post_id) return;
          if (row.status && row.status !== "visible") return;
          if (!visibleIdSetRef.current.has(row.post_id)) return;
          qc.setQueryData<FeedPost[]>(["discovery-feed"], (old) =>
            old
              ? old.map((p) =>
                  p.id === row.post_id
                    ? { ...p, comment_count: (p.comment_count ?? 0) + 1 }
                    : p,
                )
              : old,
          );
          qc.invalidateQueries({ queryKey: ["post-engagement", row.post_id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, visiblePostIds.length]);

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
    onSettled: (_res, _err, trainerId) => {
      qc.invalidateQueries({ queryKey: ["follow-counts", trainerId] });
      qc.invalidateQueries({ queryKey: ["subscription-info", trainerId] });
      if (userId) qc.invalidateQueries({ queryKey: ["follow-counts", userId] });
    },
  });

  // Registry of tile buttons so we can restore focus to whichever post is
  // currently visible when the modal closes (may differ from the initially
  // clicked tile after prev/next navigation).
  const tileRefs = useRef<Map<string, HTMLElement>>(new Map());
  const registerTile = useCallback(
    (id: string, el: HTMLElement | null) => {
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
      const uid = data.user?.id ?? null;
      setUserId(uid);
      // Invalidate the feed so it re-fetches with auth token (subscription unlock)
      void qc.invalidateQueries({ queryKey: ["discovery-feed"] });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id ?? null);
      // Re-fetch feed when login/logout changes so premium locks update correctly
      void qc.invalidateQueries({ queryKey: ["discovery-feed"] });
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [qc]);

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
        <SignInBanner
          message="Sign in to unlock your personal feed"
          sub="Follow athletes, save posts, tip creators, and get recommendations tuned to you."
        />
        {/* Hero header */}
        <header className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-2.5 py-1 font-display text-[10px] uppercase tracking-[0.3em] text-primary backdrop-blur">
                <Users className="h-3 w-3" /> Community feed
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
                placeholder="Search creators, fans, or captions"
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
          {/* Layout switcher */}
          <div
            role="tablist"
            aria-label="Layout view mode"
            className="mt-3 flex items-center gap-1 rounded-full border border-border bg-card/60 p-1 backdrop-blur sm:w-auto sm:inline-flex"
          >
            <button
              type="button"
              role="tab"
              aria-selected={layoutMode === "grid"}
              onClick={() => setLayoutMode("grid")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                layoutMode === "grid"
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              title="3-Column Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>3-Col Grid</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={layoutMode === "tiles"}
              onClick={() => setLayoutMode("tiles")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                layoutMode === "tiles"
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              title="3-Column Compact Tiles"
            >
              <Grid3x3 className="h-3.5 w-3.5" />
              <span>Tiles</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={layoutMode === "list"}
              onClick={() => setLayoutMode("list")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                layoutMode === "list"
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              title="Single Column Feed"
            >
              <List className="h-3.5 w-3.5" />
              <span>Single Column</span>
            </button>
          </div>
        </header>

        {/* Grid */}
        <section className="mt-10">
          {posts.length === 0 ? (
            <EmptyState kind={kind} />
          ) : (
            <div
              className={cn(
                layoutMode === "list"
                  ? "-mx-4 flex flex-col gap-3 sm:mx-auto sm:w-full sm:max-w-[560px] sm:gap-6"
                  : "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3",
              )}
            >
              {visiblePosts.map((p, i) =>
                layoutMode === "tiles" ? (
                  <FeedTile
                    key={p.id}
                    p={p}
                    index={i}
                    priority={i < 6}
                    signedIn={signedIn}
                    initialLiked={likedSet.has(p.id)}
                    initialSaved={savedSet.has(p.id)}
                    isFollowing={followingSet.has(p.trainer.user_id)}
                    canFollow={!signedIn || userId !== p.trainer.user_id}
                    isOwner={!!userId && userId === p.trainer.user_id}
                    followPending={
                      followMut.isPending &&
                      followMut.variables === p.trainer.user_id
                    }
                    onToggleFollow={() => {
                      if (!signedIn) {
                        openAuthGate({ action: "follow creators" });
                        return;
                      }
                      if (!followMut.isPending)
                        followMut.mutate(p.trainer.user_id);
                    }}
                    onOpen={(seed) => {
                      qc.setQueryData(["post-engagement", p.id], {
                        respect: seed.liked,
                        save: seed.saved,
                        counts: {
                          respect_count: seed.respectCount,
                          save_count: seed.saveCount,
                          comment_count: p.comment_count ?? 0,
                        },
                      });
                      setOpenId(p.id);
                    }}
                    onOpenComments={() => openComments(p.id)}
                    registerRef={(el) => registerTile(p.id, el)}
                  />
                ) : (
                  <InstaFeedCard
                    key={p.id}
                    post={p}
                    priority={i < 6}
                    signedIn={signedIn}
                    initialLiked={likedSet.has(p.id)}
                    initialSaved={savedSet.has(p.id)}
                    isFollowing={followingSet.has(p.trainer.user_id)}
                    canFollow={!signedIn || userId !== p.trainer.user_id}
                    followPending={
                      followMut.isPending &&
                      followMut.variables === p.trainer.user_id
                    }
                    onToggleFollow={() => {
                      if (!signedIn) {
                        openAuthGate({ action: "follow creators" });
                        return;
                      }
                      if (!followMut.isPending)
                        followMut.mutate(p.trainer.user_id);
                    }}
                    onOpen={(seed) => {
                      qc.setQueryData(["post-engagement", p.id], {
                        respect: seed.liked,
                        save: seed.saved,
                        counts: {
                          respect_count: seed.respectCount,
                          save_count: seed.saveCount,
                          comment_count: p.comment_count ?? 0,
                        },
                      });
                      setOpenId(p.id);
                    }}
                    onOpenComments={() => openComments(p.id)}
                    registerRef={(el) => registerTile(p.id, el)}
                    ownerMenu={
                      !!userId && userId === p.trainer.user_id ? (
                        <OwnerMenu post={p} />
                      ) : undefined
                    }
                  />
                ),
              )}
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
  priority = false,
  onOpen,
  onOpenComments,
  registerRef,
  signedIn,
  initialLiked,
  initialSaved,
  isFollowing,
  canFollow,
  isOwner,
  followPending,
  onToggleFollow,
}: {
  p: Awaited<ReturnType<typeof getDiscoveryFeed>>[number];
  index: number;
  priority?: boolean;
  onOpen: (seed: {
    liked: boolean;
    saved: boolean;
    respectCount: number;
    saveCount: number;
  }) => void;
  onOpenComments: () => void;
   registerRef?: (el: HTMLElement | null) => void;
  signedIn: boolean;
  initialLiked: boolean;
  initialSaved: boolean;
  isFollowing: boolean;
  canFollow: boolean;
  isOwner: boolean;
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
    <div
          style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
          className="group/tile relative animate-in fade-in slide-in-from-bottom-3"
        >
          {/* Ambient blurred halo — the tile's own cover art bleeding outside
              the card edges to create the "blurry feed" atmosphere. */}
          {thumb ? (
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-3 z-0 overflow-hidden rounded-[2rem] opacity-40 blur-3xl saturate-150 transition-opacity duration-500 group-hover/tile:opacity-80 motion-reduce:opacity-30 motion-reduce:transition-none sm:-inset-4"
            >
              <LazyImage
                src={thumb}
                alt=""
                aria-hidden
                showSkeleton={false}
                className="h-full w-full scale-110 object-cover"
              />
            </div>
          ) : null}
          <div
            className="group glass-tile relative z-10 aspect-square overflow-hidden rounded-2xl shadow-lg shadow-black/20 ring-1 ring-white/5 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20 hover:ring-premium/40 motion-reduce:transform-none motion-reduce:transition-none"
          >
      <Link
        to="/trainers/$username"
        params={{ username: p.trainer.username ?? p.trainer.user_id }}
        ref={registerRef as never}
        aria-label={`Go to ${p.trainer.display_name ?? trainerHref}'s profile`}
        className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />
      {thumb || p.is_premium ? (
        <ResponsiveImage
          src={thumb || undefined}
          variant="thumb"
          seed={p.id}
          sizes="(min-width: 1280px) 420px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          alt={p.caption ?? ""}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
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
        isOwner={isOwner}
        followPending={followPending}
        onToggleFollow={onToggleFollow}
      />

      {/* Premium overlay with animated vibes */}
      {p.is_premium && (
        <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="relative flex items-center justify-center">
            {/* Outer pulsing glow ring */}
            <span className="absolute h-14 w-14 rounded-full border border-primary/50 bg-primary/20 animate-lock-ring" />
            <span className="absolute h-20 w-20 rounded-full border border-primary/30 bg-primary/10 animate-ping opacity-30" />

            {/* Main glass lock icon container */}
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-primary/60 bg-black/70 text-primary shadow-2xl backdrop-blur-md animate-lock-vibes">
              <Lock className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
            </div>
          </div>

          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-black/70 px-3 py-1 font-display text-[10px] uppercase tracking-[0.3em] text-primary shadow-lg backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
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
              <LazyImage
                src={p.trainer.avatar_url}
                alt={p.trainer.display_name ?? p.trainer.username ?? "Trainer avatar"}
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
    </div>
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
          <LazyImage
            src={thumb}
            alt={post.caption || "Feed media"}
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
              <LazyImage
                src={post.trainer.avatar_url}
                alt={post.trainer.display_name ?? "Trainer avatar"}
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
  isOwner,
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
  isOwner: boolean;
  followPending: boolean;
  onToggleFollow: () => void;
}) {
  const qc = useQueryClient();
  const respectFn = useServerFn(toggleRespect);
  const saveFn = useServerFn(toggleSave);
  const shareFn = useServerFn(logShare);

  const [shared, setShared] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const stop = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const likeMut = useMutation({
    mutationFn: () => {
      if (!signedIn) {
        openAuthGate({ action: "like posts" });
        throw new Error("Unauthorized");
      }
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
      if (!signedIn) {
        openAuthGate({ action: "save posts" });
        throw new Error("Unauthorized");
      }
      return saveFn({ data: { postId: post.id } });
    },
    onMutate: () => setSaved((v) => !v),
    onError: (err: Error) => {
      setSaved((v) => !v);
      toast.error(err.message.includes("Unauthorized") ? "Sign in to save posts" : "Couldn't update save");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["discovery-feed"] }),
  });

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/trainers/${post.trainer.username ?? post.trainer.user_id}`
      : `/trainers/${post.trainer.username ?? post.trainer.user_id}`;
  const shareTitle = post.caption ?? "Check this post on LEER Sports";

  const logChannel = (channel: string) => {
    shareFn({ data: { postId: post.id, channel } }).catch(() => {
      /* not signed in — sharing still works */
    });
  };

  const flashShared = () => {
    setShared(true);
    setTimeout(() => setShared(false), 1600);
  };

  return (
    <div
      className="absolute right-2 top-2 z-20 flex items-center gap-1.5 opacity-100 transition-opacity duration-200"
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
        activeClass="bg-primary text-primary-foreground ring-primary/70 shadow-[0_0_0_2px_rgba(0,0,0,0.35),0_6px_18px_-4px_var(--primary)]"
      >
        <Heart className={cn("h-3.5 w-3.5 transition-transform", liked && "fill-current scale-110")} />
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
        activeClass="bg-accent text-accent-foreground ring-accent/70 shadow-[0_0_0_2px_rgba(0,0,0,0.35),0_6px_18px_-4px_var(--accent)]"
      >
        <Bookmark className={cn("h-3.5 w-3.5 transition-transform", saved && "fill-current scale-110")} />
      </QuickActionButton>
      <QuickActionButton
        label="Share"
        active={shared}
        loading={false}
        onClick={(e) => {
          stop(e);
          setShareOpen(true);
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
      {isOwner && <OwnerMenu post={post} />}
      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={shareUrl}
        title={shareTitle}
        onShared={(channel) => {
          logChannel(channel);
          flashShared();
        }}
      />
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

function OwnerMenu({ post }: { post: FeedPost }) {
  const qc = useQueryClient();
  const deleteFn = useServerFn(deletePost);
  const updateFn = useServerFn(updatePost);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [caption, setCaption] = useState<string>(post.caption ?? "");
  const [isPremium, setIsPremium] = useState<boolean>(post.is_premium);

  useEffect(() => {
    if (editOpen) {
      setCaption(post.caption ?? "");
      setIsPremium(post.is_premium);
    }
  }, [editOpen, post.caption, post.is_premium]);

  const stop = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const delMut = useMutation({
    mutationFn: () => deleteFn({ data: { id: post.id } }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["discovery-feed"] });
      const prev = qc.getQueryData<FeedPost[]>(["discovery-feed"]);
      if (prev) {
        qc.setQueryData<FeedPost[]>(
          ["discovery-feed"],
          prev.filter((x) => x.id !== post.id),
        );
      }
      return { prev };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["discovery-feed"], ctx.prev);
      toast.error(err.message || "Couldn't delete post");
    },
    onSuccess: () => {
      toast.success("Post deleted");
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["discovery-feed"] });
    },
  });

  const editMut = useMutation({
    mutationFn: (vars: { caption: string | null; is_premium: boolean }) =>
      updateFn({ data: { id: post.id, caption: vars.caption, is_premium: vars.is_premium } }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["discovery-feed"] });
      const prev = qc.getQueryData<FeedPost[]>(["discovery-feed"]);
      if (prev) {
        qc.setQueryData<FeedPost[]>(
          ["discovery-feed"],
          prev.map((x) =>
            x.id === post.id
              ? { ...x, caption: vars.caption, is_premium: vars.is_premium }
              : x,
          ),
        );
      }
      return { prev };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["discovery-feed"], ctx.prev);
      toast.error(err.message || "Couldn't update post");
    },
    onSuccess: () => {
      toast.success("Post updated");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["discovery-feed"] });
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Post options"
            onClick={stop}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/15 backdrop-blur transition-all duration-200 hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-90"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onClick={(e) => e.stopPropagation()}
          className="w-40"
        >
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit post
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setConfirmOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          onClick={(e) => e.stopPropagation()}
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>Edit post</DialogTitle>
            <DialogDescription>
              Update the caption or premium status for this post.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor={`caption-${post.id}`}>Caption</Label>
              <Textarea
                id={`caption-${post.id}`}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Write a caption…"
              />
              <p className="text-right text-xs text-muted-foreground">
                {caption.length}/2000
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
              <div>
                <Label htmlFor={`premium-${post.id}`} className="text-sm">
                  Premium
                </Label>
                <p className="text-xs text-muted-foreground">
                  Only subscribers can view this post.
                </p>
              </div>
              <Switch
                id={`premium-${post.id}`}
                checked={isPremium}
                onCheckedChange={setIsPremium}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditOpen(false)}
              disabled={editMut.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                editMut.mutate({
                  caption: caption.trim() ? caption.trim() : null,
                  is_premium: isPremium,
                })
              }
              disabled={editMut.isPending}
            >
              {editMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the post and its media. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={delMut.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                delMut.mutate();
              }}
              disabled={delMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {delMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
  const Icon = kind === "short" ? Video : kind === "feed" ? ImageIcon : LayoutGrid;
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
          to="/feed"
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
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8">
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
      className="relative animate-in fade-in slide-in-from-bottom-3 duration-500"
    >
      {/* Ambient blurred halo (matches FeedTile aesthetic) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] opacity-70 blur-3xl [background:radial-gradient(60%_60%_at_30%_20%,color-mix(in_oklab,var(--primary)_28%,transparent),transparent_65%),radial-gradient(50%_50%_at_80%_80%,color-mix(in_oklab,var(--accent)_22%,transparent),transparent_65%)]"
      />
      <div className="glass-tile relative aspect-[4/5] overflow-hidden rounded-2xl border border-border/60 shadow-lg shadow-black/20 sm:aspect-[3/4] lg:aspect-[4/5] xl:aspect-[3/4]">
        <div className="absolute inset-0 shimmer" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/60 via-black/25 to-transparent" />
        {/* Top-right badge */}
        <div className="absolute right-3 top-3 h-6 w-14 rounded-full bg-black/40 backdrop-blur" />
        {/* Top-left kicker */}
        <div className="absolute left-3 top-3 h-5 w-20 rounded-full bg-white/15 backdrop-blur" />
        {/* Bottom info */}
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-2.5">
          <div className="h-9 w-9 shrink-0 rounded-full bg-white/25 backdrop-blur" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-24 rounded-full bg-white/30" />
            <div className="h-2.5 w-3/4 rounded-full bg-white/20" />
          </div>
        </div>
        {/* Action rail */}
        <div className="absolute right-3 bottom-3 flex flex-col gap-2">
          <div className="h-8 w-8 rounded-full bg-white/15 backdrop-blur" />
          <div className="h-8 w-8 rounded-full bg-white/15 backdrop-blur" />
          <div className="h-8 w-8 rounded-full bg-white/15 backdrop-blur" />
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

  const isHtml = error?.message?.includes("<html") || error?.message?.includes("<!doctype");
  const cleanMsg = isHtml
    ? "Unable to connect to the server. Please check your network connection and try again."
    : error?.message || "Something went wrong while fetching posts.";

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
          {cleanMsg} Give it another try — most hiccups clear on retry.
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
            to="/feed"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 font-display text-xs uppercase tracking-widest text-foreground backdrop-blur hover:border-primary/60 hover:bg-primary/10"
          >
            Explore trainers <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Virtualized post grid
// ---------------------------------------------------------------------------

/**
 * Windowed CSS-grid: chunks posts into rows of `cols` and only mounts rows
 * near the viewport via `useWindowVirtualizer`. Keeps the visual layout
 * identical to the previous static grid (1/2/3 cols, gap-5/6/8) while
 * dramatically reducing DOM nodes once the feed passes ~60 tiles.
 */
function VirtualPostGrid({
  posts,
  renderTile,
}: {
  posts: FeedPost[];
  renderTile: (p: FeedPost, index: number, cols: number) => React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [cols, setCols] = useState<number>(() => {
    if (typeof window === "undefined") return 3;
    if (window.matchMedia("(min-width: 1024px)").matches) return 3;
    if (window.matchMedia("(min-width: 640px)").matches) return 2;
    return 1;
  });
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Track column count via matchMedia (avoids resize storms).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const lg = window.matchMedia("(min-width: 1024px)");
    const sm = window.matchMedia("(min-width: 640px)");
    const update = () => setCols(lg.matches ? 3 : sm.matches ? 2 : 1);
    update();
    lg.addEventListener("change", update);
    sm.addEventListener("change", update);
    return () => {
      lg.removeEventListener("change", update);
      sm.removeEventListener("change", update);
    };
  }, []);

  // Track container width for height estimation.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setContainerWidth(w);
    });
    ro.observe(el);
    setContainerWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // gap-5 / gap-6 / gap-8 → 20 / 24 / 32
  const gap = cols === 3 ? 32 : cols === 2 ? 24 : 20;
  // Aspect matches the tile classes: mobile 4/5, sm 3/4, lg 4/5.
  const aspect = cols === 2 ? 3 / 4 : 4 / 5;
  const colWidth =
    containerWidth > 0
      ? Math.max(120, (containerWidth - gap * (cols - 1)) / cols)
      : 320;
  const estimatedRowHeight = Math.round(colWidth / aspect) + gap;

  const rowCount = Math.ceil(posts.length / cols);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => estimatedRowHeight,
    overscan: 3,
    getScrollElement: () => (typeof window !== "undefined" ? window : null),
    scrollMargin: containerRef.current?.offsetTop ?? 0,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const scrollMargin = virtualizer.options.scrollMargin;

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        style={{ height: totalSize > 0 ? totalSize : undefined }}
        className="relative w-full"
      >
        {virtualRows.map((vr) => {
          const start = vr.index * cols;
          const rowPosts = posts.slice(start, start + cols);
          return (
            <div
              key={vr.key}
              data-index={vr.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vr.start - scrollMargin}px)`,
                paddingBottom: gap,
              }}
              className={cn(
                "grid",
                cols === 1 && "grid-cols-1 gap-5",
                cols === 2 && "grid-cols-2 gap-6",
                cols === 3 && "grid-cols-3 gap-8",
              )}
            >
              {rowPosts.map((p, i) => renderTile(p, start + i, cols))}
            </div>
          );
        })}
      </div>
    </div>
  );
}