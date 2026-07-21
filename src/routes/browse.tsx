import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Filter,
  Heart,
  HelpCircle,
  Lock,
  MapPin,
  MessageSquare,
  Play,
  Search,
  Trophy,
  Users,
  X,
} from "lucide-react";
import {
  browseClasses,
  browseCommunity,
  browsePosts,
  browseTrainers,
  getBrowseFacets,
  PAGE_SIZE,
  type BrowseClass,
  type BrowseCommunityPost,
  type BrowsePost,
  type BrowseTrainer,
} from "@/lib/browse-functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveImage } from "@/components/responsive-image";
import { cn } from "@/lib/utils";

const TABS = ["trainers", "classes", "posts", "community"] as const;
type Tab = (typeof TABS)[number];

const searchSchema = z.object({
  tab: fallback(z.string(), "trainers").default("trainers"),
  q: fallback(z.string(), "").default(""),
  page: fallback(z.number().int(), 1).default(1),
  country: fallback(z.string(), "").default(""),
  specialty: fallback(z.string(), "").default(""),
  verified: fallback(z.number().int(), 0).default(0),
  trainerSort: fallback(z.string(), "featured").default("featured"),
  category: fallback(z.string(), "").default(""),
  level: fallback(z.string(), "").default(""),
  classSort: fallback(z.string(), "soonest").default("soonest"),
  postKind: fallback(z.string(), "all").default("all"),
  postSort: fallback(z.string(), "new").default("new"),
  communityKind: fallback(z.string(), "all").default("all"),
  communitySort: fallback(z.string(), "new").default("new"),
  trainerAnswered: fallback(z.number().int(), 0).default(0),
});

type BrowseSearch = z.infer<typeof searchSchema>;

function clampTab(t: string): Tab {
  return (TABS as readonly string[]).includes(t) ? (t as Tab) : "trainers";
}

const facetsQuery = queryOptions({
  queryKey: ["browse-facets"],
  queryFn: () => getBrowseFacets(),
  staleTime: 5 * 60_000,
});

function trainersQuery(s: BrowseSearch) {
  const args = {
    q: s.q,
    country: s.country || null,
    specialty: s.specialty || null,
    verifiedOnly: s.verified === 1,
    sort: (["featured", "new", "price_low", "price_high"].includes(s.trainerSort)
      ? s.trainerSort
      : "featured") as "featured" | "new" | "price_low" | "price_high",
    page: Math.max(1, s.page),
  };
  return queryOptions({
    queryKey: ["browse", "trainers", args],
    queryFn: () => browseTrainers({ data: args }),
  });
}

function classesQuery(s: BrowseSearch) {
  const args = {
    q: s.q,
    category: s.category || null,
    level: s.level || null,
    sort: (["soonest", "new", "price_low", "price_high"].includes(s.classSort)
      ? s.classSort
      : "soonest") as "soonest" | "new" | "price_low" | "price_high",
    page: Math.max(1, s.page),
  };
  return queryOptions({
    queryKey: ["browse", "classes", args],
    queryFn: () => browseClasses({ data: args }),
  });
}

function postsQuery(s: BrowseSearch) {
  const args = {
    q: s.q,
    kind: (["feed", "short", "all"].includes(s.postKind) ? s.postKind : "all") as
      | "feed"
      | "short"
      | "all",
    country: s.country || null,
    specialty: s.specialty || null,
    verifiedOnly: s.verified === 1,
    sort: (s.postSort === "top" ? "top" : "new") as "top" | "new",
    page: Math.max(1, s.page),
  };
  return queryOptions({
    queryKey: ["browse", "posts", args],
    queryFn: () => browsePosts({ data: args }),
  });
}

function communityQuery(s: BrowseSearch) {
  const args = {
    q: s.q,
    kind: (["question", "flex", "all"].includes(s.communityKind)
      ? s.communityKind
      : "all") as "question" | "flex" | "all",
    trainerAnswered: s.trainerAnswered === 1,
    sort: (["new", "top", "trending"].includes(s.communitySort)
      ? s.communitySort
      : "new") as "new" | "top" | "trending",
    page: Math.max(1, s.page),
  };
  return queryOptions({
    queryKey: ["browse", "community", args],
    queryFn: () => browseCommunity({ data: args }),
  });
}

export const Route = createFileRoute("/browse")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context, deps }) => {
    const tab = clampTab(deps.search.tab);
    await context.queryClient.ensureQueryData(facetsQuery);
    const s = deps.search;
    switch (tab) {
      case "classes":
        await context.queryClient.ensureQueryData(classesQuery(s));
        break;
      case "posts":
        await context.queryClient.ensureQueryData(postsQuery(s));
        break;
      case "community":
        await context.queryClient.ensureQueryData(communityQuery(s));
        break;
      default:
        await context.queryClient.ensureQueryData(trainersQuery(s));
    }
  },
  head: () => ({
    meta: [
      { title: "Browse — LEER Sports" },
      {
        name: "description",
        content:
          "Search verified trainers, sports classes, posts, and community threads on LEER Sports. Filter by country, specialty, category, and more.",
      },
      { property: "og:title", content: "Browse — LEER Sports" },
      {
        property: "og:description",
        content:
          "Discover trainers, classes, posts, and community threads across LEER Sports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BrowsePage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl p-8 text-center">
      <h1 className="font-display text-2xl">Could not load browse</h1>
      <p className="mt-2 text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function BrowsePage() {
  const search = Route.useSearch();
  const tab = clampTab(search.tab);
  const navigate = Route.useNavigate();
  const { data: facets } = useSuspenseQuery(facetsQuery);

  // Debounced text input mirroring URL.
  const [qLocal, setQLocal] = useState(search.q);
  useEffect(() => {
    setQLocal(search.q);
  }, [search.q]);
  useEffect(() => {
    if (qLocal === search.q) return;
    const t = setTimeout(() => {
      navigate({ to: ".", search: (prev: BrowseSearch) => ({ ...prev, q: qLocal, page: 1 }) });
    }, 250);
    return () => clearTimeout(t);
  }, [qLocal, search.q, navigate]);

  const setSearch = (patch: Partial<BrowseSearch>) => {
    navigate({
      to: ".",
      search: (prev: BrowseSearch) => ({
        ...prev,
        ...patch,
        // Reset page on any filter change unless we're explicitly setting page.
        page: "page" in patch ? patch.page! : 1,
      }),
    });
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6">
        <span className="font-display text-xs uppercase tracking-[0.3em] text-primary">
          Browse
        </span>
        <h1 className="mt-1 font-display text-3xl uppercase tracking-tight sm:text-4xl">
          Discover LEER Sports
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Search trainers, classes, posts, and community threads. Filter, sort,
          and paginate — everything is shareable via URL.
        </p>
      </header>

      {/* Tabs */}
      <nav
        aria-label="Browse tabs"
        className="mb-4 flex flex-wrap gap-1 border-b border-border"
      >
        {TABS.map((t) => (
          <Link
            key={t}
            to="/browse"
            search={(prev: BrowseSearch) => ({ ...prev, tab: t, page: 1 })}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-display uppercase tracking-widest transition-colors",
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </Link>
        ))}
      </nav>

      {/* Search bar */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={qLocal}
            onChange={(e) => setQLocal(e.target.value)}
            placeholder={searchPlaceholder(tab)}
            aria-label="Search"
            className="pl-9 pr-9"
          />
          {qLocal && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQLocal("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter bar per tab */}
      <div className="mb-6 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {tab === "trainers" && (
            <>
              <FacetSelect
                label="Country"
                value={search.country}
                options={facets.countries}
                onChange={(v) => setSearch({ country: v })}
              />
              <FacetSelect
                label="Specialty"
                value={search.specialty}
                options={facets.specialties}
                onChange={(v) => setSearch({ specialty: v })}
              />
              <ToggleChip
                active={search.verified === 1}
                onClick={() => setSearch({ verified: search.verified === 1 ? 0 : 1 })}
              >
                <BadgeCheck className="h-3 w-3" /> Verified only
              </ToggleChip>
              <SortPicker
                value={search.trainerSort}
                onChange={(v) => setSearch({ trainerSort: v })}
                options={[
                  { value: "featured", label: "Featured" },
                  { value: "new", label: "New" },
                  { value: "price_low", label: "Price low→high" },
                  { value: "price_high", label: "Price high→low" },
                ]}
              />
            </>
          )}
          {tab === "classes" && (
            <>
              <FacetSelect
                label="Category"
                value={search.category}
                options={facets.classCategories}
                onChange={(v) => setSearch({ category: v })}
              />
              <FacetSelect
                label="Level"
                value={search.level}
                options={facets.classLevels}
                onChange={(v) => setSearch({ level: v })}
              />
              <SortPicker
                value={search.classSort}
                onChange={(v) => setSearch({ classSort: v })}
                options={[
                  { value: "soonest", label: "Soonest" },
                  { value: "new", label: "New" },
                  { value: "price_low", label: "Price low→high" },
                  { value: "price_high", label: "Price high→low" },
                ]}
              />
            </>
          )}
          {tab === "posts" && (
            <>
              <SortPicker
                value={search.postKind}
                onChange={(v) => setSearch({ postKind: v })}
                options={[
                  { value: "all", label: "All" },
                  { value: "feed", label: "Feed" },
                  { value: "short", label: "Shorts" },
                ]}
              />
              <FacetSelect
                label="Country"
                value={search.country}
                options={facets.countries}
                onChange={(v) => setSearch({ country: v })}
              />
              <FacetSelect
                label="Specialty"
                value={search.specialty}
                options={facets.specialties}
                onChange={(v) => setSearch({ specialty: v })}
              />
              <ToggleChip
                active={search.verified === 1}
                onClick={() => setSearch({ verified: search.verified === 1 ? 0 : 1 })}
              >
                <BadgeCheck className="h-3 w-3" /> Verified only
              </ToggleChip>
              <SortPicker
                value={search.postSort}
                onChange={(v) => setSearch({ postSort: v })}
                options={[
                  { value: "new", label: "New" },
                  { value: "top", label: "Top" },
                ]}
              />
            </>
          )}
          {tab === "community" && (
            <>
              <SortPicker
                value={search.communityKind}
                onChange={(v) => setSearch({ communityKind: v })}
                options={[
                  { value: "all", label: "All" },
                  { value: "question", label: "Q&A" },
                  { value: "flex", label: "FLEX" },
                ]}
              />
              <ToggleChip
                active={search.trainerAnswered === 1}
                onClick={() =>
                  setSearch({
                    trainerAnswered: search.trainerAnswered === 1 ? 0 : 1,
                  })
                }
              >
                <BadgeCheck className="h-3 w-3" /> Trainer answered
              </ToggleChip>
              <SortPicker
                value={search.communitySort}
                onChange={(v) => setSearch({ communitySort: v })}
                options={[
                  { value: "new", label: "New" },
                  { value: "top", label: "Top" },
                  { value: "trending", label: "Trending" },
                ]}
              />
            </>
          )}
          {hasAnyFilter(search, tab) && (
            <button
              type="button"
              onClick={() =>
                navigate({
                  to: ".",
                  search: (prev: BrowseSearch) => ({
                    ...prev,
                    q: "",
                    country: "",
                    specialty: "",
                    category: "",
                    level: "",
                    verified: 0,
                    trainerAnswered: 0,
                    page: 1,
                  }),
                })
              }
              className="ml-auto text-xs text-muted-foreground underline hover:text-foreground"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {tab === "trainers" && <TrainersPanel search={search} />}
      {tab === "classes" && <ClassesPanel search={search} />}
      {tab === "posts" && <PostsPanel search={search} />}
      {tab === "community" && <CommunityPanel search={search} />}
    </main>
  );
}

function searchPlaceholder(tab: Tab): string {
  switch (tab) {
    case "trainers":
      return "Search trainers by name, username, or bio…";
    case "classes":
      return "Search classes by title, instructor, or description…";
    case "posts":
      return "Search posts by caption…";
    case "community":
      return "Search community threads by title or body…";
  }
}

function hasAnyFilter(s: BrowseSearch, tab: Tab): boolean {
  if (s.q) return true;
  if (tab === "trainers" || tab === "posts")
    return !!(s.country || s.specialty) || s.verified === 1;
  if (tab === "classes") return !!(s.category || s.level);
  if (tab === "community") return s.trainerAnswered === 1;
  return false;
}

// -------- Panels --------

function TrainersPanel({ search }: { search: BrowseSearch }) {
  const { data } = useSuspenseQuery(trainersQuery(search));
  if (data.items.length === 0)
    return <EmptyState message="No trainers match those filters." />;
  return (
    <>
      <ResultsSummary total={data.total} page={data.page} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((t) => (
          <TrainerCard key={t.user_id} t={t} />
        ))}
      </div>
      <Pagination total={data.total} page={data.page} />
    </>
  );
}

function ClassesPanel({ search }: { search: BrowseSearch }) {
  const { data } = useSuspenseQuery(classesQuery(search));
  if (data.items.length === 0)
    return <EmptyState message="No classes match those filters." />;
  return (
    <>
      <ResultsSummary total={data.total} page={data.page} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((c) => (
          <ClassCard key={c.id} c={c} />
        ))}
      </div>
      <Pagination total={data.total} page={data.page} />
    </>
  );
}

function PostsPanel({ search }: { search: BrowseSearch }) {
  const { data } = useSuspenseQuery(postsQuery(search));
  if (data.items.length === 0)
    return <EmptyState message="No posts match those filters." />;
  return (
    <>
      <ResultsSummary total={data.total} page={data.page} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {data.items.map((p) => (
          <PostCard key={p.id} p={p} />
        ))}
      </div>
      <Pagination total={data.total} page={data.page} />
    </>
  );
}

function CommunityPanel({ search }: { search: BrowseSearch }) {
  const { data } = useSuspenseQuery(communityQuery(search));
  if (data.items.length === 0)
    return <EmptyState message="No community posts match those filters." />;
  return (
    <>
      <ResultsSummary total={data.total} page={data.page} />
      <div className="space-y-3">
        {data.items.map((c) => (
          <CommunityCard key={c.id} c={c} />
        ))}
      </div>
      <Pagination total={data.total} page={data.page} />
    </>
  );
}

// -------- Cards --------

function TrainerCard({ t }: { t: BrowseTrainer }) {
  return (
    <Link
      to="/trainers/$username"
      params={{ username: t.username ?? t.user_id }}
      className="group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary"
    >
      <div
        className="relative h-24 w-full bg-muted"
        style={{
          backgroundImage: t.cover_url ? `url(${t.cover_url})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="p-4">
        <div className="-mt-10 mb-3 flex items-end gap-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-4 border-card bg-muted">
            {t.avatar_url ? (
              <img src={t.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-lg text-muted-foreground">
                {(t.display_name ?? t.username ?? "?")[0]?.toUpperCase()}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <h3 className="truncate font-display text-lg">
            {t.display_name ?? t.username ?? "Trainer"}
          </h3>
          {t.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
        </div>
        {t.country && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" /> {t.country}
          </p>
        )}
        {t.bio && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{t.bio}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-1">
          {t.specialties.slice(0, 3).map((s) => (
            <span
              key={s}
              className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Users className="h-3 w-3" /> {t.post_count} post{t.post_count === 1 ? "" : "s"}
          </span>
          <span className="font-display text-primary">
            ${t.subscription_price.toFixed(2)}/mo
          </span>
        </div>
      </div>
    </Link>
  );
}

function ClassCard({ c }: { c: BrowseClass }) {
  const when = new Date(c.schedule);
  return (
    <Link
      to="/classes/$classId"
      params={{ classId: c.id }}
      className="group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary"
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
          <span className="rounded-full border border-border px-2 py-0.5">
            {c.level}
          </span>
        </div>
        <h3 className="mt-2 line-clamp-2 font-display text-lg">{c.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">with {c.instructor}</p>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {when.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
          <span className="font-display text-primary">${c.price.toFixed(2)}</span>
        </div>
      </div>
    </Link>
  );
}

function PostCard({ p }: { p: BrowsePost }) {
  const thumb = p.thumbnail_url ?? p.media_url;
  const trainerHref = p.trainer.username ?? p.trainer.user_id;
  return (
    <Link
      to="/trainers/$username"
      params={{ username: trainerHref }}
      className="group relative block aspect-square overflow-hidden rounded-md border border-border bg-card"
    >
      {thumb && !p.is_premium ? (
        <ResponsiveImage
          src={thumb}
          variant="thumb"
          seed={p.id}
          sizes="(min-width: 1024px) 240px, (min-width: 640px) 33vw, 50vw"
          alt={p.caption ?? ""}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-card to-muted" />
      )}
      {p.is_premium && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60">
          <Lock className="h-5 w-5 text-primary" />
          <span className="mt-1 font-display text-[10px] uppercase tracking-widest text-primary">
            Premium
          </span>
        </div>
      )}
      {p.kind === "short" && !p.is_premium && (
        <div className="absolute right-2 top-2 rounded-full bg-background/70 p-1">
          <Play className="h-3 w-3" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-background/95 to-transparent px-2 py-2 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-muted">
            {p.trainer.avatar_url && (
              <img src={p.trainer.avatar_url} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <span className="truncate text-[11px] font-medium">
            {p.trainer.display_name ?? p.trainer.username ?? "Trainer"}
          </span>
          {p.trainer.is_verified && (
            <BadgeCheck className="h-3 w-3 shrink-0 text-primary" />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[10px]">
          <span className="flex items-center gap-0.5">
            <Heart className="h-3 w-3" /> {p.respect_count}
          </span>
          <span className="flex items-center gap-0.5">
            <MessageSquare className="h-3 w-3" /> {p.comment_count}
          </span>
          <span className="flex items-center gap-0.5">
            <Bookmark className="h-3 w-3" /> {p.save_count}
          </span>
        </div>
      </div>
    </Link>
  );
}

function CommunityCard({ c }: { c: BrowseCommunityPost }) {
  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <header className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          {c.kind === "question" ? (
            <>
              <HelpCircle className="h-3 w-3" /> Q&A
            </>
          ) : (
            <>
              <Trophy className="h-3 w-3" /> FLEX
            </>
          )}
        </span>
        <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px]">
          {c.author.avatar_url ? (
            <img src={c.author.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            (c.author.display_name ?? c.author.username ?? "?")[0]?.toUpperCase()
          )}
        </span>
        <span className="font-medium">
          {c.author.display_name ?? c.author.username ?? "user"}
        </span>
        {c.author.is_trainer && <BadgeCheck className="h-3.5 w-3.5 text-primary" />}
        <span className="text-muted-foreground">
          · {new Date(c.created_at).toLocaleDateString()}
        </span>
        {c.trainer_answered && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-primary/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary">
            <BadgeCheck className="h-3 w-3" /> Trainer answered
          </span>
        )}
      </header>
      <h2 className="mt-3 font-display text-lg uppercase tracking-tight">{c.title}</h2>
      {c.body && (
        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
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
      {c.top_reply && (
        <blockquote className="mt-3 rounded-md border-l-2 border-primary/40 bg-muted/40 p-2 text-xs text-muted-foreground">
          <span className="mr-1 font-medium text-foreground">
            {c.top_reply.author_display ?? "Reply"}
            {c.top_reply.is_trainer && (
              <BadgeCheck className="ml-1 inline h-3 w-3 text-primary" />
            )}
            :
          </span>
          <span className="line-clamp-2 align-middle">{c.top_reply.body}</span>
        </blockquote>
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
  );
}

// -------- Shared bits --------

function ResultsSummary({ total, page }: { total: number; page: number }) {
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(total, page * PAGE_SIZE);
  return (
    <p className="mb-3 text-xs text-muted-foreground">
      Showing <span className="font-medium text-foreground">{start}</span>–
      <span className="font-medium text-foreground">{end}</span> of {total}
    </p>
  );
}

function Pagination({ total, page }: { total: number; page: number }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label="Pagination"
      className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-4 text-sm"
    >
      <Link
        to="/browse"
        disabled={page <= 1}
        aria-disabled={page <= 1}
        search={(prev: BrowseSearch) => ({ ...prev, page: Math.max(1, page - 1) })}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5",
          page <= 1 && "pointer-events-none opacity-40",
        )}
      >
        <ChevronLeft className="h-4 w-4" /> Prev
      </Link>
      <span className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Link
        to="/browse"
        disabled={page >= totalPages}
        aria-disabled={page >= totalPages}
        search={(prev: BrowseSearch) => ({
          ...prev,
          page: Math.min(totalPages, page + 1),
        })}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5",
          page >= totalPages && "pointer-events-none opacity-40",
        )}
      >
        Next <ChevronRight className="h-4 w-4" />
      </Link>
    </nav>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-16 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function FacetSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs">
      <span className="font-display uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-xs text-foreground focus:outline-none"
      >
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-display uppercase tracking-widest transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/60",
      )}
    >
      {children}
    </button>
  );
}

function SortPicker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs">
      <span className="font-display uppercase tracking-widest text-muted-foreground">
        Sort
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-xs text-foreground focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// Silence unused type import warnings from React.ReactNode in older setups.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
null;