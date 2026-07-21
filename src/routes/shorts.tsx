import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Heart, Bookmark, Share2, Lock, ChevronUp, ChevronDown } from "lucide-react";
import { getShortsFeed, type DiscoveryPost } from "@/lib/trainer-functions";
import { cn } from "@/lib/utils";

const shortsQuery = queryOptions({
  queryKey: ["shorts-feed"],
  queryFn: () => getShortsFeed(),
});

export const Route = createFileRoute("/shorts")({
  loader: ({ context }) => context.queryClient.ensureQueryData(shortsQuery),
  head: () => ({
    meta: [
      { title: "Shorts — LEER Sports" },
      {
        name: "description",
        content: "Vertical fitness shorts from verified elite trainers.",
      },
      { property: "og:title", content: "Shorts — LEER Sports" },
      {
        property: "og:description",
        content: "Vertical fitness shorts from verified elite trainers.",
      },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShortsPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function ShortsPage() {
  const { data: shorts } = useSuspenseQuery(shortsQuery);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = entry.target.querySelector("video");
          if (!video) continue;
          const idx = Number((entry.target as HTMLElement).dataset.index);
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            setActiveIndex(idx);
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      },
      { root: container, threshold: [0, 0.6, 1] },
    );
    container.querySelectorAll("[data-short]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [shorts.length]);

  const scrollBy = (dir: 1 | -1) => {
    const container = containerRef.current;
    if (!container) return;
    const height = container.clientHeight;
    container.scrollBy({ top: dir * height, behavior: "smooth" });
  };

  if (shorts.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-muted-foreground">No shorts yet.</p>
      </div>
    );
  }

  return (
    <div className="relative bg-black">
      <div
        ref={containerRef}
        className="h-[calc(100vh-4rem)] snap-y snap-mandatory overflow-y-auto"
      >
        {shorts.map((p, i) => (
          <ShortSlide key={p.id} post={p} index={i} />
        ))}
      </div>

      {/* Arrow controls (desktop) */}
      <div className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 flex-col gap-2 md:flex">
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          disabled={activeIndex === 0}
          className="pointer-events-auto rounded-full border border-border bg-background/70 p-2 text-foreground backdrop-blur transition-colors hover:border-primary disabled:opacity-40"
          aria-label="Previous"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => scrollBy(1)}
          disabled={activeIndex === shorts.length - 1}
          className="pointer-events-auto rounded-full border border-border bg-background/70 p-2 text-foreground backdrop-blur transition-colors hover:border-primary disabled:opacity-40"
          aria-label="Next"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function ShortSlide({ post, index }: { post: DiscoveryPost; index: number }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  const trainerHref = post.trainer.username ?? post.trainer.user_id;

  return (
    <section
      data-short
      data-index={index}
      className="relative flex h-[calc(100vh-4rem)] snap-start items-center justify-center"
    >
      <div className="relative aspect-[9/16] h-full max-h-[calc(100vh-4rem)] w-full max-w-[420px] overflow-hidden rounded-none bg-neutral-950 sm:rounded-lg">
        {post.is_premium ? (
          <div className="relative h-full w-full">
            {post.thumbnail_url && (
              <img
                src={post.thumbnail_url}
                alt=""
                className={cn("h-full w-full object-cover", "locked-blur")}
              />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/40">
              <Lock className="h-8 w-8 text-primary" />
              <span className="mt-2 font-display text-sm uppercase tracking-widest text-primary">
                Premium Short
              </span>
              <Link
                to="/trainers/$username"
                params={{ username: trainerHref }}
                className="mt-3 rounded-full border border-primary px-4 py-1.5 text-xs font-display uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground"
              >
                Subscribe to Watch
              </Link>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={post.media_url}
            poster={post.thumbnail_url ?? undefined}
            playsInline
            loop
            muted={muted}
            onClick={() => setMuted((m) => !m)}
            className="h-full w-full object-cover"
          />
        )}

        {/* Overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {/* Bottom info */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4">
          <div className="min-w-0 text-white">
            <Link
              to="/trainers/$username"
              params={{ username: trainerHref }}
              className="flex min-w-0 items-center gap-2"
            >
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/40 bg-neutral-800">
                {post.trainer.avatar_url && (
                  <img
                    src={post.trainer.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <span className="truncate font-display text-sm uppercase tracking-widest">
                {post.trainer.display_name ?? post.trainer.username}
              </span>
              {post.trainer.is_verified && (
                <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
              )}
            </Link>
            {post.caption && (
              <p className="mt-2 line-clamp-3 text-sm text-white/90">{post.caption}</p>
            )}
          </div>
          <ShortActions post={post} />
        </div>

        {muted && !post.is_premium && (
          <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[10px] uppercase tracking-widest text-white">
            Tap to unmute
          </div>
        )}
      </div>
    </section>
  );
}

function ShortActions({ post }: { post: DiscoveryPost }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-4 text-white">
      <ActionBtn icon={<Heart className="h-5 w-5" />} label={post.respect_count} />
      <ActionBtn icon={<Bookmark className="h-5 w-5" />} label={post.save_count} />
      <ActionBtn icon={<Share2 className="h-5 w-5" />} label="Share" />
    </div>
  );
}

function ActionBtn({ icon, label }: { icon: React.ReactNode; label: React.ReactNode }) {
  return (
    <button
      type="button"
      className="pointer-events-auto flex flex-col items-center gap-1 text-white/90 transition-colors hover:text-primary"
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-black/50 backdrop-blur">
        {icon}
      </span>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}