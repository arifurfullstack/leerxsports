import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  queryOptions,
  useSuspenseQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Bookmark,
  Check,
  Clock,
  Filter,
  Flame,
  Play,
  Plus,
  Search,
  Shuffle,
  Compass,
  X,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getExplorePosts,
  getExploreFacets,
  type DiscoveryPost,
} from "@/lib/trainer-functions";
import { toggleFollow, getFollowingIds } from "@/lib/subscription-functions";
import { toggleSave } from "@/lib/engagement-functions";
import { openAuthGate } from "@/lib/auth-gate";
import { ResponsiveImage } from "@/components/responsive-image";
import { SignInBanner } from "@/components/sign-in-banner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";

type Kind = "all" | "feed" | "short";
type Sort = "top" | "recent" | "random";

const facetsQuery = queryOptions({
  queryKey: ["explore", "facets"],
  queryFn: () => getExploreFacets(),
  staleTime: 5 * 60 * 1000,
});

function postsQueryOptions(params: {
  kind: Kind;
  country: string | null;
  specialty: string | null;
  verifiedOnly: boolean;
  sort: Sort;
}) {
  return queryOptions({
    queryKey: ["explore", "posts", params],
    queryFn: () => getExplorePosts({ data: params }),
    staleTime: 30 * 1000,
  });
}

export const Route = createFileRoute("/explore")({
  loader: async ({ context }) => {
    try {
      await Promise.all([
        context.queryClient.ensureQueryData(facetsQuery),
        context.queryClient.ensureQueryData(
          postsQueryOptions({
            kind: "all",
            country: null,
            specialty: null,
            verifiedOnly: false,
            sort: "top",
          }),
        ),
      ]);
    } catch (e) {
      console.error("Explore loader error:", e);
    }
  },
  head: () => ({
    meta: [
      { title: "Explore — LEER" },
      {
        name: "description",
        content:
          "Discover trending fitness reels, posts, and verified creators on LEER. Filter by sport, country, and more.",
      },
      { property: "og:title", content: "Explore — LEER" },
      {
        property: "og:description",
        content: "Trending posts and creators across LEER.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExplorePage,
  errorComponent: ({ error }) => {
    const isHtml = error.message?.includes("<html") || error.message?.includes("<!doctype");
    const cleanMsg = isHtml
      ? "Unable to connect to the server. Please check your network connection and try again."
      : error.message || "An unexpected error occurred while loading explore content.";
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <Compass className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
          Could not load explore content
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{cleanMsg}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => window.location.reload()} className="font-bold bg-primary text-primary-foreground">
            Try Again
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Go Home</Link>
          </Button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function ExplorePage() {
  const [kind, setKind] = useState<Kind>("all");
  const [sort, setSort] = useState<Sort>("top");
  const [country, setCountry] = useState<string | null>(null);
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [query, setQuery] = useState("");

  const { data: facetsData } = useQuery(facetsQuery);
  const facets = facetsData ?? { countries: [], specialties: [] };
  const { data: posts, isFetching, isPending } = useQuery(
    postsQueryOptions({ kind, country, specialty, verifiedOnly, sort }),
  );
  const showSkeleton = isPending || (isFetching && !posts);

  const qc = useQueryClient();
  const navigate = useNavigate();
  const user = qc.getQueryData<{ id: string } | null>(["navbar-user"]) ?? null;
  const isSignedIn = !!user?.id;

  // Follow state for signed-in users
  const { data: followingIds } = useQuery({
    queryKey: ["explore", "following-ids"],
    queryFn: () => getFollowingIds(),
    enabled: isSignedIn,
    staleTime: 60 * 1000,
  });
  const followingSet = useMemo(
    () => new Set(followingIds ?? []),
    [followingIds],
  );
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const requireAuth = () => {
    if (isSignedIn) return true;
    openAuthGate({ action: "curate your feed" });
    return false;
  };

  const followFn = useServerFn(toggleFollow);
  const followMut = useMutation({
    mutationFn: (trainerId: string) => followFn({ data: { trainerId } }),
    onMutate: async (trainerId) => {
      await qc.cancelQueries({ queryKey: ["explore", "following-ids"] });
      const prev = qc.getQueryData<string[]>(["explore", "following-ids"]) ?? [];
      const next = prev.includes(trainerId)
        ? prev.filter((id) => id !== trainerId)
        : [...prev, trainerId];
      qc.setQueryData(["explore", "following-ids"], next);
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["explore", "following-ids"], ctx.prev);
      toast.error((err as Error).message ?? "Could not update follow");
    },
    onSuccess: ({ following }, trainerId) => {
      toast.success(following ? "Following" : "Unfollowed");
      const cur = qc.getQueryData<string[]>(["explore", "following-ids"]) ?? [];
      const inList = cur.includes(trainerId);
      if (following && !inList) qc.setQueryData(["explore", "following-ids"], [...cur, trainerId]);
      if (!following && inList) qc.setQueryData(["explore", "following-ids"], cur.filter((id) => id !== trainerId));
    },
    onSettled: (_res, _err, trainerId) => {
      qc.invalidateQueries({ queryKey: ["follow-counts", trainerId] });
      qc.invalidateQueries({ queryKey: ["subscription-info", trainerId] });
      if (user?.id) qc.invalidateQueries({ queryKey: ["follow-counts", user.id] });
    },
  });

  const saveFn = useServerFn(toggleSave);
  const saveMut = useMutation({
    mutationFn: (postId: string) => saveFn({ data: { postId } }),
    onMutate: (postId) => {
      setSavedIds((s) => {
        const n = new Set(s);
        if (n.has(postId)) n.delete(postId);
        else n.add(postId);
        return n;
      });
    },
    onError: (err, postId) => {
      setSavedIds((s) => {
        const n = new Set(s);
        if (n.has(postId)) n.delete(postId);
        else n.add(postId);
        return n;
      });
      toast.error((err as Error).message ?? "Could not update save");
    },
    onSuccess: ({ save }) => {
      toast.success(save ? "Saved to your collection" : "Removed from saves");
    },
  });

  const onToggleFollow = (trainerId: string, selfId?: string) => {
    if (!requireAuth()) return;
    if (selfId && user?.id === selfId) return;
    followMut.mutate(trainerId);
  };
  const onToggleSave = (postId: string) => {
    if (!requireAuth()) return;
    saveMut.mutate(postId);
  };

  const q = query.trim().toLowerCase();
  const filteredPosts = q
    ? (posts ?? []).filter((p) => {
        const handle = p.trainer.username ?? "";
        const name = p.trainer.display_name ?? "";
        const caption = p.caption ?? "";
        return (
          handle.toLowerCase().includes(q) ||
          name.toLowerCase().includes(q) ||
          caption.toLowerCase().includes(q)
        );
      })
    : posts;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <SignInBanner
        message="Sign in to unlock Explore"
        sub="Follow creators, save what you love, and get a feed tuned to your tastes."
      />
      <header className="mb-8 flex flex-col gap-3">
        <span className="font-display text-xs uppercase tracking-[0.3em] text-primary">
          Discover
        </span>
        <h1 className="font-display text-4xl uppercase tracking-tight sm:text-5xl">
          Explore
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          The best posts, reels, and creators across LEER — curated by
          engagement and freshness.
        </p>
      </header>

      {/* Kind tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative flex h-9 min-w-[220px] flex-1 items-center rounded-full border border-border bg-card pl-9 pr-2 text-sm focus-within:border-primary/60 focus-within:bg-background sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-primary" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search creators or captions…"
            aria-label="Search explore"
            className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>

        {(["all", "feed", "short"] as Kind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`rounded-full border px-4 py-1.5 text-xs uppercase tracking-wider transition-colors ${
              kind === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
            }`}
          >
            {k === "all" ? "All" : k === "feed" ? "Posts" : "Reels"}
          </button>
        ))}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Toggle
            pressed={verifiedOnly}
            onPressedChange={setVerifiedOnly}
            size="sm"
            aria-label="Verified only"
            className="gap-1.5"
          >
            <BadgeCheck className="h-3.5 w-3.5" /> Verified
          </Toggle>

          <Select
            value={country ?? "all"}
            onValueChange={(v) => setCountry(v === "all" ? null : v)}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All countries</SelectItem>
              {facets.countries.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={specialty ?? "all"}
            onValueChange={(v) => setSpecialty(v === "all" ? null : v)}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="Specialty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All specialties</SelectItem>
              {facets.specialties.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex overflow-hidden rounded-md border border-border">
            {(
              [
                { v: "top", label: "Top", Icon: Flame },
                { v: "recent", label: "New", Icon: Clock },
                { v: "random", label: "Mix", Icon: Shuffle },
              ] as { v: Sort; label: string; Icon: typeof Flame }[]
            ).map(({ v, label, Icon }) => (
              <button
                key={v}
                onClick={() => setSort(v)}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs uppercase tracking-wider transition-colors ${
                  sort === v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="h-3 w-3" /> {label}
              </button>
            ))}
          </div>

          {(country || specialty || verifiedOnly) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setCountry(null);
                setSpecialty(null);
                setVerifiedOnly(false);
              }}
              className="h-8 gap-1 text-xs"
            >
              <Filter className="h-3 w-3" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      {showSkeleton ? (
        <ExploreGridSkeleton />
      ) : !filteredPosts || filteredPosts.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-16 text-center">
          <Compass className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-display text-lg">
            {q
              ? "No matches"
              : verifiedOnly || country || specialty
                ? "No posts match these filters"
                : kind === "short"
                  ? "No reels yet"
                  : kind === "feed"
                    ? "No posts yet"
                    : "Nothing here yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {q
              ? "Try a different search term or clear filters."
              : "Try clearing filters or switching sort order."}
          </p>
          {(country || specialty || verifiedOnly || q) && (
            <Button
              size="sm"
              variant="outline"
              className="mt-4 gap-1 text-xs"
              onClick={() => {
                setCountry(null);
                setSpecialty(null);
                setVerifiedOnly(false);
                setQuery("");
              }}
            >
              <Filter className="h-3 w-3" /> Reset filters
            </Button>
          )}
        </div>
      ) : (
        <div
          className={`grid gap-3 sm:gap-4 ${
            isFetching ? "opacity-70 transition-opacity" : ""
          } grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`}
        >
          {filteredPosts.map((p) => (
            <ExploreTile
              key={p.id}
              post={p}
              isFollowing={followingSet.has(p.trainer.user_id)}
              isSelf={user?.id === p.trainer.user_id}
              isSaved={savedIds.has(p.id)}
              onToggleFollow={() => onToggleFollow(p.trainer.user_id, p.trainer.user_id)}
              onToggleSave={() => onToggleSave(p.id)}
              followPending={followMut.isPending && followMut.variables === p.trainer.user_id}
              savePending={saveMut.isPending && saveMut.variables === p.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ExploreGridSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-lg border border-border bg-card"
        >
          <div className="relative aspect-square w-full animate-pulse bg-muted">
            <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/40 to-transparent p-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-muted-foreground/20" />
                <div className="h-2.5 w-24 rounded bg-muted-foreground/20" />
              </div>
              <div className="h-2 w-32 rounded bg-muted-foreground/15" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ExploreTile({
  post,
  isFollowing,
  isSelf,
  isSaved,
  onToggleFollow,
  onToggleSave,
  followPending,
  savePending,
}: {
  post: DiscoveryPost;
  isFollowing: boolean;
  isSelf: boolean;
  isSaved: boolean;
  onToggleFollow: () => void;
  onToggleSave: () => void;
  followPending: boolean;
  savePending: boolean;
}) {
  const isShort = post.kind === "short";
  const thumb = post.thumbnail_url || (isShort ? null : post.media_url);
  const trainerHandle = post.trainer.username ?? post.trainer.user_id;

  return (
    <Link
      to="/trainers/$username"
      params={{ username: post.trainer.username ?? post.trainer.user_id }}
      className="group relative block overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="relative aspect-square w-full bg-muted">
        {post.is_premium ? (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-background">
            <span className="rounded-full border border-primary/50 bg-background/70 px-3 py-1 text-[10px] uppercase tracking-wider text-primary backdrop-blur">
              Premium
            </span>
          </div>
        ) : thumb ? (
          <ResponsiveImage
            src={thumb}
            variant="feed"
            seed={post.id}
            alt={post.caption ?? "Post"}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Play className="h-8 w-8" />
          </div>
        )}

        {isShort && (
          <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white backdrop-blur">
            Reel
          </div>
        )}

        {/* Save action (top-right) */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (savePending) return;
            onToggleSave();
          }}
          aria-label={isSaved ? "Unsave post" : "Save post"}
          aria-pressed={isSaved}
          disabled={savePending}
          className={`absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition-colors ${
            isSaved
              ? "border-primary bg-primary text-primary-foreground"
              : "border-white/30 bg-black/50 text-white hover:border-primary hover:text-primary"
          } ${savePending ? "opacity-60" : ""}`}
        >
          <Bookmark
            className={`h-3.5 w-3.5 ${isSaved ? "fill-current" : ""}`}
          />
        </button>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 text-white">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full border border-white/30 bg-muted">
              {post.trainer.avatar_url ? (
                <ResponsiveImage
                  src={post.trainer.avatar_url}
                  variant="avatar"
                  seed={trainerHandle}
                  alt={post.trainer.display_name ?? trainerHandle}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <span className="truncate text-xs font-medium">
              {post.trainer.display_name ?? trainerHandle}
            </span>
            {post.trainer.is_verified && (
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
            )}
            {!isSelf && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (followPending) return;
                  onToggleFollow();
                }}
                aria-label={isFollowing ? "Unfollow creator" : "Follow creator"}
                aria-pressed={isFollowing}
                disabled={followPending}
                className={`ml-auto flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] uppercase tracking-wider transition-colors ${
                  isFollowing
                    ? "border-white/40 bg-white/10 text-white hover:border-primary hover:text-primary"
                    : "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                } ${followPending ? "opacity-60" : ""}`}
              >
                {isFollowing ? (
                  <>
                    <Check className="h-3 w-3" /> Following
                  </>
                ) : (
                  <>
                    <Plus className="h-3 w-3" /> Follow
                  </>
                )}
              </button>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-[10px] uppercase tracking-wider text-white/80">
            <span>{fmtCount(post.respect_count)} respects</span>
            <span>{fmtCount(post.comment_count)} comments</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}