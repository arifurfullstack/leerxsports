import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Loader2, X, Lock, Play, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createPost } from "@/lib/post-functions";

export function PostComposer({ userId }: { userId: string }) {
  const [kind, setKind] = useState<"feed" | "short">("feed");
  const [isPremium, setIsPremium] = useState(false);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const createPostFn = useServerFn(createPost);

  const submit = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Please choose a file first.");
      setUploading(true);
      try {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("post-media")
          .upload(path, file, { contentType: file.type });
        if (upErr) throw new Error(upErr.message);
        await createPostFn({
          data: {
            kind,
            is_premium: isPremium,
            caption: caption.trim() || null,
            media_path: path,
          },
        });
      } finally {
        setUploading(false);
      }
    },
    onSuccess: () => {
      setFile(null);
      setPreview(null);
      setCaption("");
      setIsPremium(false);
      setError(null);
      qc.invalidateQueries({ queryKey: ["my-posts"] });
      qc.invalidateQueries({ queryKey: ["trainer"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleFile = (f: File | null) => {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
    if (f) {
      setKind(f.type.startsWith("video/") ? "short" : "feed");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-display text-lg uppercase tracking-widest">
        New Post
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Upload an image (Feed) or a vertical video (Shorts). Mark it Premium to
        lock it behind your monthly subscription.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr]">
        <label
          htmlFor="post-file"
          className="relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-background transition-colors hover:border-primary"
        >
          {preview ? (
            file?.type.startsWith("video/") ? (
              <video src={preview} className="h-full w-full object-cover" muted />
            ) : (
              <img src={preview} alt="preview" className="h-full w-full object-cover" loading="lazy" decoding="async" />
            )
          ) : (
            <div className="flex flex-col items-center text-muted-foreground">
              <Upload className="h-6 w-6" />
              <span className="mt-1 text-xs">Click to upload</span>
            </div>
          )}
          <input
            id="post-file"
            type="file"
            accept="image/*,video/*"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          {preview && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                handleFile(null);
              }}
              className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-foreground"
              aria-label="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </label>

        <div className="space-y-3">
          <div>
            <Label>Type</Label>
            <div className="mt-1 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={kind === "feed" ? "default" : "outline"}
                onClick={() => setKind("feed")}
              >
                <ImageIcon className="mr-1 h-3 w-3" /> Feed
              </Button>
              <Button
                type="button"
                size="sm"
                variant={kind === "short" ? "default" : "outline"}
                onClick={() => setKind("short")}
              >
                <Play className="mr-1 h-3 w-3" /> Short
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="caption">Caption</Label>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Say something about this post…"
              rows={3}
              className="mt-1"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPremium}
              onChange={(e) => setIsPremium(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <Lock className="h-3 w-3 text-primary" />
            <span>Premium (subscribers only)</span>
          </label>

          {error && (
            <p className="rounded border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <Button
              onClick={() => submit.mutate()}
              disabled={!file || uploading || submit.isPending}
            >
              {uploading || submit.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing…
                </>
              ) : (
                "Publish Post"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}