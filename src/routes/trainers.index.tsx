import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BadgeCheck, MapPin, Languages, Search, Filter, X } from "lucide-react";
import { listTrainers } from "@/lib/trainer-functions";
import { ResponsiveImage } from "@/components/responsive-image";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const trainersQuery = queryOptions({
  queryKey: ["trainers"],
  queryFn: () => listTrainers(),
});

export const Route = createFileRoute("/trainers/")({
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(trainersQuery);
    } catch (e) {
      console.error("Trainers loader error:", e);
    }
  },
  head: () => ({
    meta: [
      { title: "Creators — LEER" },
      {
        name: "description",
        content:
          "Discover verified elite fitness creators on LEER Sports. Filter by country, language, and sport.",
      },
      { property: "og:title", content: "Creators — LEER" },
      {
        property: "og:description",
        content: "Discover verified elite fitness creators on LEER Sports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrainersIndex,
  errorComponent: ({ error }) => {
    const isHtml = error.message?.includes("<html") || error.message?.includes("<!doctype");
    const cleanMsg = isHtml
      ? "Unable to connect to the server. Please check your connection."
      : error.message || "An error occurred while loading creators.";
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">
          Could not load creators
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

function TrainersIndex() {
  const { data: trainersData } = useQuery(trainersQuery);
  const trainers = trainersData ?? [];

  const [query, setQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);

  // Extract unique countries and languages dynamically
  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const t of trainers) {
      if (t.country) set.add(t.country);
    }
    return Array.from(set).sort();
  }, [trainers]);

  const languages = useMemo(() => {
    const set = new Set<string>();
    for (const t of trainers) {
      if ((t as any).native_language) set.add((t as any).native_language);
      for (const lang of (t as any).additional_languages ?? []) set.add(lang);
    }
    return Array.from(set).sort();
  }, [trainers]);

  // Filter trainers (Global by default)
  const filteredTrainers = useMemo(() => {
    return trainers.filter((t) => {
      const q = query.trim().toLowerCase();
      if (q) {
        const name = (t.display_name ?? "").toLowerCase();
        const handle = (t.username ?? "").toLowerCase();
        const bio = (t.bio ?? "").toLowerCase();
        if (!name.includes(q) && !handle.includes(q) && !bio.includes(q)) return false;
      }
      if (selectedCountry && t.country !== selectedCountry) return false;
      if (selectedLanguage) {
        const native = (t as any).native_language;
        const additional = (t as any).additional_languages ?? [];
        if (native !== selectedLanguage && !additional.includes(selectedLanguage)) return false;
      }
      return true;
    });
  }, [trainers, query, selectedCountry, selectedLanguage]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-3">
        <span className="font-display text-xs uppercase tracking-[0.3em] text-primary">
          Verified · Global Discovery
        </span>
        <h1 className="font-display text-4xl uppercase tracking-tight sm:text-5xl">
          Elite Trainers
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Every trainer on LEER is manually reviewed. Feeds and trainer listings are global by default — filter below to find native-language trainers.
        </p>
      </div>

      {/* Manual Country & Language Filter Toolbar */}
      <div className="mb-8 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        {/* Search */}
        <div className="relative flex min-w-[200px] flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search trainers or keywords…"
            className="h-9 w-full rounded-md border border-border/60 bg-background pl-9 pr-8 text-sm outline-none focus:border-primary"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Country Filter */}
        <Select
          value={selectedCountry ?? "all"}
          onValueChange={(v) => setSelectedCountry(v === "all" ? null : v)}
        >
          <SelectTrigger className="h-9 w-[160px] text-xs font-semibold">
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Language Filter */}
        <Select
          value={selectedLanguage ?? "all"}
          onValueChange={(v) => setSelectedLanguage(v === "all" ? null : v)}
        >
          <SelectTrigger className="h-9 w-[160px] text-xs font-semibold">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Languages</SelectItem>
            {languages.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(selectedCountry || selectedLanguage || query) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedCountry(null);
              setSelectedLanguage(null);
              setQuery("");
            }}
            className="h-9 text-xs text-muted-foreground hover:text-foreground"
          >
            Reset Filters
          </Button>
        )}
      </div>

      {filteredTrainers.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <p className="text-muted-foreground">
            No trainers found matching your active country or language filters.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTrainers.map((t) => (
            <Link
              key={t.user_id}
              to="/trainers/$username"
              params={{ username: t.username ?? t.user_id }}
              className="group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary"
            >
              <div
                className="relative h-32 w-full bg-muted"
                style={{
                  backgroundImage: t.cover_url ? `url(${t.cover_url})` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="absolute -bottom-8 left-4 z-10">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-4 border-card bg-muted shadow-md">
                    {t.avatar_url ? (
                      <ResponsiveImage
                        src={t.avatar_url}
                        variant="avatar"
                        seed={t.username ?? t.display_name ?? "trainer"}
                        alt={t.display_name ?? t.username ?? "Trainer"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-display text-xl text-muted-foreground">
                        {(t.display_name ?? t.username ?? "?")[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 pt-10">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 font-display text-lg font-bold uppercase tracking-tight group-hover:text-primary">
                    {t.display_name ?? t.username ?? "Unnamed Trainer"}
                    {t.is_verified && <BadgeCheck className="h-4 w-4 text-primary shrink-0" />}
                  </h3>
                  {t.subscription_price > 0 && (
                    <span className="text-xs font-bold text-primary">
                      ${t.subscription_price}/mo
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">@{t.username ?? "trainer"}</p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {t.country && (
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground font-medium">
                      <MapPin className="h-3 w-3 text-primary" /> {t.country}
                    </span>
                  )}
                  {(t as any).native_language && (
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground font-medium">
                      <Languages className="h-3 w-3 text-primary" /> {(t as any).native_language}
                    </span>
                  )}
                </div>

                {t.bio && (
                  <p className="mt-3 line-clamp-2 text-xs text-foreground/80 leading-relaxed">
                    {t.bio}
                  </p>
                )}

                {t.specialties.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {t.specialties.slice(0, 3).map((s) => (
                      <span
                        key={s}
                        className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
