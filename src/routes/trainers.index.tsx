import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { BadgeCheck, MapPin } from "lucide-react";
import { listTrainers } from "@/lib/trainer-functions";
import { ResponsiveImage } from "@/components/responsive-image";
import { Button } from "@/components/ui/button";

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
          "Discover verified elite fitness creators on LEER Sports. Follow, subscribe, and book private online coaching.",
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10 flex flex-col gap-3">
        <span className="font-display text-xs uppercase tracking-[0.3em] text-primary">
          Verified · Global
        </span>
        <h1 className="font-display text-4xl uppercase tracking-tight sm:text-5xl">
          Elite Trainers
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Every trainer on LEER is manually reviewed. Subscribe for premium
          content and one video coaching call each month.
        </p>
      </div>

      {trainers.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <p className="text-muted-foreground">
            No trainers have been approved yet. Check back soon.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {trainers.map((t) => (
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
              <div className="px-4 pb-4 pt-11">
                <div className="flex items-center gap-1.5">
                  <h3 className="truncate font-display text-lg">
                    {t.display_name ?? t.username}
                  </h3>
                  {t.is_verified && (
                    <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </div>
                {t.country && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {t.country}
                  </p>
                )}
                {t.bio && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {t.bio}
                  </p>
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
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">Subscribe</span>
                  <span className="font-display text-primary">
                    ${t.subscription_price.toFixed(2)}/mo
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
