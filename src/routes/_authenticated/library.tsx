import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, Crown, ShoppingBag, Loader2, BadgeCheck, Film, Image as ImageIcon } from "lucide-react";
import { listMyUnlockedPosts, type UnlockedPost } from "@/lib/library-functions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ResponsiveImage } from "@/components/responsive-image";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/library")({
  component: LibraryPage,
  head: () => ({
    meta: [
      { title: "My Library · LEER" },
      {
        name: "description",
        content:
          "Every premium post you've unlocked on LEER — from subscriptions and one-off purchases.",
      },
      { property: "og:title", content: "My Library · LEER" },
      {
        property: "og:description",
        content: "Your unlocked LEER content, all in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Filter = "all" | "purchase" | "subscription";

function LibraryPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const fetchLibrary = useServerFn(listMyUnlockedPosts);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["library"],
    queryFn: () => fetchLibrary(),
    staleTime: 30_000,
  });

  const list = data ?? [];
  const counts = useMemo(
    () => ({
      all: list.length,
      purchase: list.filter((p) => p.source === "purchase").length,
      subscription: list.filter((p) => p.source === "subscription").length,
    }),
    [list],
  );
  const filtered = useMemo(
    () => (filter === "all" ? list : list.filter((p) => p.source === filter)),
    [list, filter],
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface-1 px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Crown className="h-3.5 w-3.5" aria-hidden />
            Your unlocked content
          </div>
          <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
            My Library
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Everything you can view on LEER — from active creator subscriptions and one-off unlocks.
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl leading-none">{counts.all}</p>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total unlocked</p>
        </div>
      </header>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">
            All <span className="ml-1.5 text-xs opacity-70">{counts.all}</span>
          </TabsTrigger>
          <TabsTrigger value="subscription">
            <Crown className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Subscription <span className="ml-1.5 text-xs opacity-70">{counts.subscription}</span>
          </TabsTrigger>
          <TabsTrigger value="purchase">
            <ShoppingBag className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Purchased <span className="ml-1.5 text-xs opacity-70">{counts.purchase}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
              Loading your library…
            </div>
          ) : isError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-8 text-center">
              <p className="mb-3 text-sm">Could not load your library.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            <ul
              className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:gap-1.5 lg:grid-cols-4"
              role="list"
            >
              {filtered.map((p) => (
                <li key={p.id}>
                  <LibraryTile post={p} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}

function LibraryTile({ post }: { post: UnlockedPost }) {
  const thumb = post.thumbnail_url ?? post.media_url;
  const isVideo = post.kind === "short";
  return (
    <Link
      to="/posts/$postId"
      params={{ postId: post.id }}
      className={cn(
        "group relative isolate block aspect-square w-full overflow-hidden rounded-md bg-surface-1",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
      aria-label={`View unlocked post by ${post.trainer.display_name ?? post.trainer.username ?? "creator"}`}
    >
      {thumb ? (
        <ResponsiveImage
          src={thumb}
          variant="thumb"
          seed={post.id}
          sizes="(min-width: 1024px) 240px, (min-width: 640px) 33vw, 50vw"
          alt={post.caption ?? (isVideo ? "Video" : "Photo")}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
        />
      ) : (
        <div className="h-full w-full bg-linear-to-br from-[oklch(0.14_0.007_20)] to-[oklch(0.08_0.005_20)]" />
      )}
      {/* Gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Source badge */}
      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur">
        {post.source === "purchase" ? (
          <>
            <ShoppingBag className="h-3 w-3" aria-hidden />
            Purchased
          </>
        ) : (
          <>
            <Crown className="h-3 w-3" aria-hidden />
            Sub
          </>
        )}
      </div>

      {/* Media kind icon */}
      <div className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white backdrop-blur">
        {isVideo ? <Film className="h-3 w-3" aria-hidden /> : <ImageIcon className="h-3 w-3" aria-hidden />}
      </div>

      {/* Creator footer */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 p-2 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <span className="truncate text-xs font-medium drop-shadow">
          @{post.trainer.username ?? "creator"}
        </span>
        {post.trainer.is_verified && (
          <BadgeCheck className="h-3.5 w-3.5 flex-shrink-0 text-primary drop-shadow" aria-label="Verified" />
        )}
      </div>
    </Link>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  const copy =
    filter === "purchase"
      ? {
          title: "No purchased posts yet",
          body: "One-off unlocks appear here after you buy a premium post from a creator.",
        }
      : filter === "subscription"
          ? {
              title: "No active subscriptions",
              body: "Subscribe to a creator to unlock their full library — it'll all live right here.",
            }
          : {
              title: "Your library is empty",
              body: "Unlock a premium post or subscribe to a creator to start building your library.",
            };
  return (
    <div className="rounded-2xl border border-border/60 bg-surface-1 py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Lock className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="mb-2 font-display text-xl uppercase tracking-tight">{copy.title}</h2>
      <p className="mx-auto mb-6 max-w-sm text-sm text-muted-foreground">{copy.body}</p>
      <Button asChild>
        <Link to="/trainers">Browse creators</Link>
      </Button>
    </div>
  );
}