import { Lock, Play, Heart, Bookmark, Image as ImageIcon, Film } from "lucide-react";
import type { Post } from "@/lib/trainer-functions";
import { cn } from "@/lib/utils";
import { ResponsiveImage } from "./responsive-image";

export function PostTile({
  post,
  onClick,
  unlockedUrl,
}: {
  post: Post;
  onClick?: () => void;
  /** If provided, use this signed URL instead of the (stripped) premium URL. */
  unlockedUrl?: string | null;
}) {
  const rawThumb = post.thumbnail_url ?? post.media_url;
  const thumb = post.is_premium && unlockedUrl ? unlockedUrl : rawThumb;
  const locked = post.is_premium && !unlockedUrl && !post.media_url;
  const isVideo = post.kind === "short";
  const label = locked
    ? "Locked premium post — subscribe to unlock"
    : (post.caption ?? (isVideo ? "Video post" : "Photo post"));
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "group relative isolate aspect-square w-full overflow-hidden bg-surface-1",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "before:absolute before:inset-0 before:pointer-events-none before:opacity-0 before:transition-opacity",
        "before:bg-[linear-gradient(180deg,transparent_55%,oklch(0_0_0/60%))] group-hover:before:opacity-100",
      )}
      style={{ backgroundColor: "var(--surface-1)" }}
    >
      {thumb ? (
        <ResponsiveImage
          src={thumb}
          variant="thumb"
          seed={post.id}
          sizes="(min-width: 1024px) 240px, (min-width: 640px) 33vw, 50vw"
          alt={post.caption ?? (isVideo ? "Video" : "Photo")}
          className={cn(
            "h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]",
            locked && "locked-blur",
          )}
        />
      ) : (
        <div className="h-full w-full bg-linear-to-br from-[oklch(0.14_0.007_20)] to-[oklch(0.08_0.005_20)]" />
      )}

      {/* Media-type badge (top-right) — hidden while locked so the lock reads first */}
      {!locked && (
        <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-1">
          <span
            className="grid h-6 w-6 place-items-center rounded-full bg-[oklch(0_0_0/60%)] text-[oklch(1_0_0)] shadow-elevated backdrop-blur-sm"
            aria-hidden="true"
          >
            {isVideo ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
          </span>
        </div>
      )}

      {/* Locked-media overlay — Gymshark red accent, reserved for paid content */}
      {locked && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="relative flex items-center justify-center">
            <span className="absolute h-14 w-14 rounded-full border border-primary/50 bg-primary/20 animate-lock-ring" />
            <span className="absolute h-18 w-18 rounded-full border border-primary/30 bg-primary/10 animate-ping opacity-30" />
            <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-primary/60 bg-black/70 text-primary shadow-2xl backdrop-blur-md animate-lock-vibes">
              <Lock className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
            </div>
          </div>
          <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-black/70 px-3 py-0.5 font-display text-[9px] uppercase tracking-[0.25em] text-primary shadow-lg backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Premium
          </span>
        </div>
      )}

      {post.kind === "short" && !locked && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center opacity-90 transition-opacity group-hover:opacity-100">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-[oklch(0_0_0/55%)] backdrop-blur-sm ring-1 ring-[oklch(1_0_0/25%)]">
            <Play className="h-4 w-4 fill-current text-[oklch(1_0_0)]" />
          </span>
        </div>
      )}

      {/* Hover stats strip */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 px-2.5 py-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[oklch(1_0_0)] drop-shadow">
          <Heart className="h-3.5 w-3.5 fill-current" /> {post.respect_count}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[oklch(1_0_0)] drop-shadow">
          <Bookmark className="h-3.5 w-3.5 fill-current" /> {post.save_count}
        </span>
      </div>
    </button>
  );
}