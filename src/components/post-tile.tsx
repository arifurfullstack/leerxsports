import { Lock, Play, Heart, Bookmark } from "lucide-react";
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
  const locked = post.is_premium && !unlockedUrl;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-square w-full overflow-hidden rounded-md border border-border bg-card"
    >
      {thumb ? (
        <ResponsiveImage
          src={thumb}
          variant="thumb"
          seed={post.id}
          sizes="(min-width: 1024px) 240px, (min-width: 640px) 33vw, 50vw"
          alt={post.caption ?? "Post"}
          className={cn(
            "h-full w-full object-cover transition-transform group-hover:scale-105",
            locked && "locked-blur",
          )}
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-card to-muted" />
      )}
      {locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/40 backdrop-blur-sm">
          <Lock className="h-6 w-6 text-primary" />
          <span className="mt-1 font-display text-[10px] uppercase tracking-widest text-primary">
            Premium
          </span>
        </div>
      )}
      {post.kind === "short" && !locked && (
        <div className="absolute right-2 top-2 rounded-full bg-background/70 p-1">
          <Play className="h-3 w-3 text-foreground" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-background/80 to-transparent px-2 py-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="flex items-center gap-1 text-xs text-foreground">
          <Heart className="h-3 w-3" /> {post.respect_count}
        </span>
        <span className="flex items-center gap-1 text-xs text-foreground">
          <Bookmark className="h-3 w-3" /> {post.save_count}
        </span>
      </div>
    </button>
  );
}