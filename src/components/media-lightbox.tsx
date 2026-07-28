import { useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SmartImage } from "@/components/smart-image";
import { VideoPlayer } from "@/components/video-player";

export type LightboxItem = {
  src: string;
  kind?: "image" | "video";
  alt?: string;
};

export function MediaLightbox({
  items,
  index,
  onIndexChange,
  onClose,
}: {
  items: LightboxItem[];
  index: number | null;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const open = index !== null && index >= 0 && index < items.length;
  const current = open ? items[index!] : null;
  const hasPrev = open && index! > 0;
  const hasNext = open && index! < items.length - 1;

  const go = useCallback(
    (delta: number) => {
      if (index === null) return;
      const next = index + delta;
      if (next < 0 || next >= items.length) return;
      onIndexChange(next);
    },
    [index, items.length, onIndexChange],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] border-none bg-transparent p-0 shadow-none sm:max-w-[90vw]">
        <div className="relative flex h-[90vh] items-center justify-center">
          {current?.kind === "video" ? (
            <div className="flex h-full w-full items-center justify-center">
              <VideoPlayer
                key={current.src}
                src={current.src}
                title={current.alt}
                autoPlay
                aspectRatio="16/9"
                className="max-h-full w-full"
              />
            </div>
          ) : current ? (
            <SmartImage
              key={current.src}
              src={current.src}
              alt={current.alt ?? ""}
              widths={[640, 960, 1280, 1920]}
              sizes="(max-width: 640px) 100vw, 90vw"
              targetWidth={1280}
              quality={82}
              fit="contain"
              eager
              rounded
              className="h-full w-full"
            />
          ) : null}

          {hasPrev && (
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-2 text-foreground backdrop-blur transition hover:bg-background"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-2 text-foreground backdrop-blur transition hover:bg-background"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {items.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/70 px-3 py-1 text-xs font-bold uppercase tracking-widest text-foreground backdrop-blur">
              {(index ?? 0) + 1} / {items.length}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
