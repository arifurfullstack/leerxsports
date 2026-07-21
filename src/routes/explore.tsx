import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BadgeCheck, Filter, Heart, Bookmark, Lock, Play, Shuffle, Clock, Flame } from "lucide-react";
import {
  getExplorePosts,
  getExploreFacets,
  type ExploreFilters,
} from "@/lib/trainer-functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ResponsiveImage } from "@/components/responsive-image";

const facetsQuery = queryOptions({
  queryKey: ["explore-facets"],
  queryFn: () => getExploreFacets(),
});

function exploreQuery(filters: Required<ExploreFilters>) {
  return queryOptions({
    queryKey: ["explore", filters],
    queryFn: () => getExplorePosts({ data: filters }),
  });
}

export const Route = createFileRoute("/explore")({
  loader: ({ context }) => context.queryClient.ensureQueryData(facetsQuery),
  head: () => ({
    meta: [
      { title: "Explore — LEER Sports" },
      {
        name: "description",
        content:
          "Filter fitness content by country, specialty, and format. Discover verified elite trainers worldwide.",
      },
      { property: "og:title", content: "Explore — LEER Sports" },
      {
        property: "og:description",
        content: "Filter fitness content by country, specialty, and format.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExplorePage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

type Sort = "top" | "recent" | "random";
type Kind = "feed" | "short" | "all";

function ExplorePage() {
  const { data: facets } = useSuspenseQuery(facetsQuery);
  const [kind, setKind] = useState<Kind>("all");
  const [country, setCountry] = useState<string | null>(null);
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("top");

  const filters = { kind, country, specialty, verifiedOnly, sort, excludeDemo: false };
  const { data: posts, isLoading } = useQuery(exploreQuery(filters));

  const clearAll = () => {
    setKind("all");
    setCountry(null);
    setSpecialty(null);
    setVerifiedOnly(false);
    setSort("top");
  };

  const anyFilter =
    kind !== "all" || country || specialty || verifiedOnly || sort !== "top";

  return (
    <div className="mx-auto max-w-6xl px-3 py-8 sm:px-6">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <span className="font-display text-xs uppercase tracking-[0.3em] text-primary">
            Explore
          </span>
          <h1 className="mt-1 font-display text-3xl uppercase tracking-tight sm:text-4xl">
            Find Your Trainer
          </h1>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Filter className="h-3 w-3" />
          <span>{posts?.length ?? 0} results</span>
        </div>
      </header>

      {/* Filter bar */}
      <div className="mb-6 space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentGroup
            value={kind}
            options={[
              { value: "all", label: "All" },
              { value: "feed", label: "Feed" },
              { value: "short", label: "Shorts" },
            ]}
            onChange={(v) => setKind(v as Kind)}
          />
          <div className="ml-auto flex items-center gap-2">
            <SortBtn active={sort === "top"} onClick={() => setSort("top")}>
              <Flame className="h-3 w-3" /> Top
            </SortBtn>
            <SortBtn active={sort === "recent"} onClick={() => setSort("recent")}>
              <Clock className="h-3 w-3" /> New
            </SortBtn>
            <SortBtn active={sort === "random"} onClick={() => setSort("random")}>
              <Shuffle className="h-3 w-3" /> Shuffle
            </SortBtn>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Select
            label="Country"
            value={country}
            onChange={setCountry}
            options={facets.countries}
          />
          <Select
            label="Specialty"
            value={specialty}
            onChange={setSpecialty}
            options={facets.specialties}
          />
          <button
            type="button"
            onClick={() => setVerifiedOnly((v) => !v)}
            className={cn(
              "flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-display uppercase tracking-widest transition-colors",
              verifiedOnly
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/60",
            )}
          >
            <BadgeCheck className="h-3 w-3" /> Verified only
          </button>
          {anyFilter && (
            <button
              type="button"
              onClick={clearAll}
              className="ml-auto text-xs text-muted-foreground underline hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <PostGridSkeleton />
      ) : !posts || posts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-16 text-center text-sm text-muted-foreground">
          No posts match those filters.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 sm:gap-2 md:grid-cols-4">
          {posts.map((p) => {
            const isNew = Date.now() - new Date(p.created_at).getTime() < 24 * 3600e3;
            const thumb = p.thumbnail_url ?? p.media_url;
            const trainerHref = p.trainer.username ?? p.trainer.user_id;
            return (
              <Link
                key={p.id}
                to="/trainers/$username"
                params={{ username: trainerHref }}
                className={cn(
                  "group relative block aspect-square overflow-hidden rounded-md border border-border bg-card",
                  isNew && "premium-pulse ring-1 ring-primary",
                )}
              >
                {thumb ? (
                  <ResponsiveImage
                    src={thumb}
                    variant="thumb"
                    seed={p.id}
                    sizes="(min-width: 1024px) 240px, (min-width: 640px) 33vw, 50vw"
                    alt={p.caption ?? ""}
                    className={cn(
                      "h-full w-full object-cover transition-transform group-hover:scale-105",
                      p.is_premium && "locked-blur",
                    )}
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-card to-muted" />
                )}
                {p.is_premium && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/40">
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
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-background/95 to-transparent px-2 py-2 sm:opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-muted">
                      {p.trainer.avatar_url && (
                        <img
                          src={p.trainer.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <span className="truncate text-[11px] font-medium">
                      {p.trainer.display_name ?? p.trainer.username}
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
                      <Bookmark className="h-3 w-3" /> {p.save_count}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SegmentGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-display uppercase tracking-widest transition-colors",
            value === o.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SortBtn({
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
        "flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-display uppercase tracking-widest transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/60",
      )}
    >
      {children}
    </button>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: string[];
}) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs">
      <span className="font-display uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
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

function PostGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 sm:gap-2 md:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="aspect-square animate-pulse rounded-md border border-border bg-card"
        />
      ))}
    </div>
  );
}