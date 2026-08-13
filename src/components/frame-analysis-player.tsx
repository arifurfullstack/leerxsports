import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Gauge,
  Maximize2,
  Minimize2,
  Clock,
  Sparkles,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type AnalysisMarker = {
  time: number; // in seconds
  title: string;
  note: string;
};

interface FrameAnalysisPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  markers?: AnalysisMarker[];
  className?: string;
}

const FRAME_RATE = 30; // 30 fps standard for video posture analysis
const FRAME_DURATION = 1 / FRAME_RATE; // ~0.0333s per frame

export function FrameAnalysisPlayer({
  src,
  poster,
  title,
  markers = [],
  className = "",
}: FrameAnalysisPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeMarker, setActiveMarker] = useState<AnalysisMarker | null>(null);

  // Sync state with HTML video element
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      setCurrentTime(t);

      // Highlight active marker if currentTime is within 1s window
      const found = markers.find((m) => Math.abs(m.time - t) <= 1);
      setActiveMarker(found ?? null);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // ─── Frame-by-Frame Controls ───────────────────────────────────────────────
  const stepFrame = useCallback((direction: -1 | 1) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);

    const nextTime = Math.max(
      0,
      Math.min(videoRef.current.duration, videoRef.current.currentTime + direction * FRAME_DURATION)
    );
    videoRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, []);

  const seekTo = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const changeSpeed = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (!document.fullscreenElement) {
      videoRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Calculate current frame number
  const currentFrame = Math.floor(currentTime * FRAME_RATE);
  const totalFrames = Math.floor(duration * FRAME_RATE);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`overflow-hidden rounded-xl border border-border bg-black shadow-lg ${className}`}>
      {/* Video Display Container */}
      <div className="relative aspect-video w-full bg-black">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onClick={togglePlay}
          className="h-full w-full object-contain cursor-pointer"
        />

        {/* Live Frame Counter Overlay */}
        <div className="absolute top-3 left-3 flex items-center gap-2 rounded-md bg-black/70 px-2.5 py-1 text-[11px] font-mono text-white backdrop-blur-md border border-white/10">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span>{formatTime(currentTime)}</span>
          <span className="text-white/40">|</span>
          <span className="text-primary font-semibold">Frame {currentFrame}</span>
          <span className="text-white/40">/ {totalFrames}</span>
        </div>

        {/* Active Posture Analysis Overlay Banner */}
        {activeMarker && (
          <div className="absolute bottom-14 left-3 right-3 rounded-lg border border-primary/40 bg-black/85 p-3 text-white backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Posture Analysis @ {formatTime(activeMarker.time)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{activeMarker.note}</p>
          </div>
        )}
      </div>

      {/* Scrub Bar & Timeline */}
      <div className="border-t border-white/10 bg-neutral-950 px-4 py-2">
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={FRAME_DURATION}
            value={currentTime}
            onChange={(e) => seekTo(parseFloat(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-neutral-800 accent-primary focus:outline-none"
          />
          {/* Marker indicators on timeline */}
          {markers.map((m, idx) => {
            const leftPct = duration ? (m.time / duration) * 100 : 0;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => seekTo(m.time)}
                style={{ left: `${leftPct}%` }}
                title={`${m.title} (${formatTime(m.time)})`}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-primary ring-2 ring-black hover:scale-125 transition-transform"
              />
            );
          })}
        </div>
      </div>

      {/* Toolbar Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-neutral-900 px-4 py-3 text-xs text-white">
        {/* Playback & Frame Stepping */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={togglePlay}
            className="h-8 w-8 text-white hover:bg-white/10"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>

          <div className="h-4 w-[1px] bg-white/20 mx-1" />

          {/* Frame Step Back */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => stepFrame(-1)}
            className="h-8 border-white/20 bg-neutral-800 px-2 text-[11px] font-medium text-white hover:bg-neutral-700 hover:border-primary/50"
            title="Step Back 1 Frame (1/30s)"
          >
            <ChevronLeft className="mr-1 h-3.5 w-3.5" />
            -1 Frame
          </Button>

          {/* Frame Step Forward */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => stepFrame(1)}
            className="h-8 border-white/20 bg-neutral-800 px-2 text-[11px] font-medium text-white hover:bg-neutral-700 hover:border-primary/50"
            title="Step Forward 1 Frame (1/30s)"
          >
            +1 Frame
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-1">
          <Gauge className="h-3.5 w-3.5 text-muted-foreground mr-1" />
          {[0.25, 0.5, 1, 2].map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => changeSpeed(speed)}
              className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wider transition-colors ${
                playbackRate === speed
                  ? "bg-primary text-black"
                  : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Right side tools */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => seekTo(0)}
            className="p-1 text-neutral-400 hover:text-white transition-colors"
            title="Restart Video"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1 text-neutral-400 hover:text-white transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Frame-by-Frame Posture Analysis Markers Section */}
      {markers.length > 0 && (
        <div className="border-t border-white/10 bg-neutral-950 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
              <Info className="h-3.5 w-3.5" /> Posture Analysis Keyframes
            </span>
            <span className="text-[10px] text-muted-foreground">Click marker to jump to frame</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {markers.map((m, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => seekTo(m.time)}
                className="flex items-start gap-2.5 rounded-lg border border-white/10 bg-neutral-900 p-2.5 text-left transition-all hover:border-primary/50 hover:bg-neutral-850 group"
              >
                <span className="shrink-0 rounded bg-primary/20 px-2 py-0.5 text-[10px] font-mono font-bold text-primary group-hover:bg-primary group-hover:text-black transition-colors">
                  {formatTime(m.time)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">{m.title}</p>
                  <p className="text-[11px] text-neutral-400 line-clamp-2">{m.note}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
