import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, UploadCloud, X, ImageIcon, Video } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { createStory } from "@/lib/story-functions";

const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 60;
const MAX_CAPTION = 240;

type Kind = "image" | "video";

export function StoryComposerDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string | null;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<Kind>("image");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [videoMs, setVideoMs] = useState<number | null>(null);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const createStoryFn = useServerFn(createStory);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreviewUrl(null);
      setCaption("");
      setVideoMs(null);
      setPct(0);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const captionLeft = MAX_CAPTION - caption.length;

  const submit = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      if (!file) throw new Error("Pick an image or video first");
      const maxMb = kind === "video" ? MAX_VIDEO_MB : MAX_IMAGE_MB;
      if (file.size > maxMb * 1024 * 1024) {
        throw new Error(`${kind === "video" ? "Video" : "Image"} must be under ${maxMb} MB`);
      }
      setError(null);
      setPct(8);

      // Reserve quota
      const { data: reserve, error: rErr } = await supabase.rpc("try_record_upload", {
        _bytes: file.size,
      });
      if (rErr) throw rErr;
      const r = reserve as { allowed: boolean; reason?: string } | null;
      if (!r?.allowed) {
        throw new Error(
          r?.reason === "storage_limit"
            ? "You've reached your storage limit."
            : "You've reached today's upload limit.",
        );
      }
      setPct(20);

      const ext = (file.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg")).toLowerCase();
      const path = `${userId}/stories/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("post-media")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      setPct(80);

      await createStoryFn({
        data: {
          media_path: path,
          media_kind: kind,
          caption: caption.trim() || null,
          duration_ms:
            kind === "video"
              ? Math.max(1000, Math.min(60_000, Math.round(videoMs ?? 8000)))
              : 5000,
        },
      });
      setPct(100);
    },
    onSuccess: () => {
      toast.success("Your story is live for 24 hours");
      qc.invalidateQueries({ queryKey: ["stories", "active"] });
      qc.invalidateQueries({ queryKey: ["upload-quota"] });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      setError(e.message || "Something went wrong");
      setPct(0);
    },
  });

  const dropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const stop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onDrop = (e: DragEvent) => {
      stop(e);
      const f = e.dataTransfer?.files?.[0];
      if (f) pickFile(f);
    };
    el.addEventListener("dragover", stop);
    el.addEventListener("dragenter", stop);
    el.addEventListener("dragleave", stop);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragover", stop);
      el.removeEventListener("dragenter", stop);
      el.removeEventListener("dragleave", stop);
      el.removeEventListener("drop", onDrop);
    };
  }, []);

  const pickFile = (f: File) => {
    if (f.type.startsWith("video/")) setKind("video");
    else if (f.type.startsWith("image/")) setKind("image");
    else {
      setError("Only images or videos are supported");
      return;
    }
    setError(null);
    setFile(f);
  };

  const canPublish = useMemo(() => !!file && !submit.isPending, [file, submit.isPending]);

  return (
    <Dialog open={open} onOpenChange={(o) => (submit.isPending ? null : onOpenChange(o))}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg flex-col overflow-hidden p-0 sm:max-h-[85dvh] sm:max-w-xl sm:rounded-2xl border border-border/70 bg-card/95 backdrop-blur-2xl shadow-2xl">
        <DialogHeader className="border-b border-border/60 px-4 py-3 sm:px-5">
          <DialogTitle className="font-display text-lg tracking-tight text-foreground">Share to your story</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Your story will be visible to signed-in members for 24 hours.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 p-4 sm:p-5">
          <div
            ref={dropRef}
            className="relative overflow-hidden rounded-2xl border-2 border-dashed border-border/60 bg-black/40"
          >
            {previewUrl ? (
              <div className="relative flex max-h-[40vh] min-h-[220px] w-full items-center justify-center bg-black/60 sm:max-h-[340px]">
                {kind === "video" ? (
                  <video
                    src={previewUrl}
                    controls
                    playsInline
                    onLoadedMetadata={(e) => {
                      const d = (e.currentTarget.duration || 0) * 1000;
                      if (Number.isFinite(d) && d > 0) setVideoMs(d);
                    }}
                    className="max-h-[40vh] w-full object-contain sm:max-h-[340px]"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Story preview"
                    className="max-h-[40vh] w-full object-contain sm:max-h-[340px]"
                  />
                )}
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => setFile(null)}
                  disabled={submit.isPending}
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white transition hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
                  {kind === "video" ? <Video className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                  <span className="capitalize">{kind}</span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex min-h-[220px] w-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground transition hover:bg-muted/30"
              >
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    Tap to upload or drag &amp; drop
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    JPG, PNG up to {MAX_IMAGE_MB} MB · MP4 up to {MAX_VIDEO_MB} MB
                  </p>
                </div>
              </button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
                e.currentTarget.value = "";
              }}
            />
          </div>

          {file && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Caption <span className="text-muted-foreground/60">(optional)</span>
                </label>
                <span className="text-[11px] text-muted-foreground">
                  {captionLeft} left
                </span>
              </div>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
                placeholder="Say something about this moment…"
                rows={2}
                disabled={submit.isPending}
                className="resize-none rounded-xl border-border/60 bg-background/60 text-sm"
              />
            </div>
          )}

          {submit.isPending && (
            <div className="space-y-2 rounded-xl border border-border/60 bg-background/60 p-3">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                <span>Publishing story…</span>
                <span>{pct}%</span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive">
              {error}
            </p>
          )}
        </div>

        {/* Footer (Always Sticky & Visible at bottom) */}
        <div className="sticky bottom-0 z-10 flex items-center justify-between border-t border-border/60 bg-card/95 px-4 py-3 backdrop-blur sm:px-5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submit.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => submit.mutate()}
            disabled={!canPublish}
            className="min-w-[130px] font-bold"
          >
            {submit.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing
              </>
            ) : (
              "Share story"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}