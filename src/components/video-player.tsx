import { MediaPlayer, MediaProvider, Poster } from "@vidstack/react";
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import { cn } from "@/lib/utils";

export type VideoPlayerProps = {
  src: string;
  poster?: string | null;
  title?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  aspectRatio?: string; // e.g. "16/9", "9/16", "1/1"
  className?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
};

/**
 * Lightweight, accessible video player powered by Vidstack.
 * Drop-in replacement for <video> elements across the app.
 */
export function VideoPlayer({
  src,
  poster,
  title,
  autoPlay = false,
  muted = false,
  loop = false,
  controls = true,
  aspectRatio = "16/9",
  className,
  onPlay,
  onPause,
  onEnded,
}: VideoPlayerProps) {
  return (
    <MediaPlayer
      title={title}
      src={src}
      autoplay={autoPlay}
      muted={muted}
      loop={loop}
      playsinline
      aspectRatio={aspectRatio}
      onPlay={onPlay}
      onPause={onPause}
      onEnded={onEnded}
      className={cn(
        "overflow-hidden rounded-xl bg-black ring-1 ring-white/5",
        className,
      )}
    >
      <MediaProvider>
        {poster ? <Poster src={poster} alt={title ?? ""} className="vds-poster" /> : null}
      </MediaProvider>
      {controls ? (
        <DefaultVideoLayout icons={defaultLayoutIcons} />
      ) : null}
    </MediaPlayer>
  );
}