import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Lock, Unlock, VideoIcon, X, Loader2, Send, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { addCommunityComment } from "@/lib/community-functions";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB (HD video)
const ACCEPTED = ["video/mp4", "video/quicktime", "video/webm", "image/jpeg", "image/png", "image/gif", "image/webp"];

interface TrainerReplyBoxProps {
  postId: string;
  trainerId: string;
  coachingStatus?: "pending" | "coached" | "coaching_completed" | null;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function TrainerReplyBox({ postId, trainerId, coachingStatus, onSuccess }: TrainerReplyBoxProps) {
  const addFn = useServerFn(addCommunityComment);

  // RBAC: Verify the current user holds a verified trainer role and verified profile before rendering
  const [isVerifiedTrainer, setIsVerifiedTrainer] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", trainerId)
        .eq("role", "trainer")
        .maybeSingle();

      const { data: profRow } = await supabase
        .from("trainer_profiles")
        .select("is_verified")
        .eq("user_id", trainerId)
        .maybeSingle();

      const { data: appRow } = await supabase
        .from("trainer_applications")
        .select("status")
        .eq("user_id", trainerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const isPendingOrRejected =
        appRow?.status === "pending" ||
        appRow?.status === "rejected" ||
        appRow?.status === "resubmit";

      if (alive) {
        setIsVerifiedTrainer(Boolean(roleRow && profRow?.is_verified && !isPendingOrRejected));
      }
    })();
    return () => { alive = false; };
  }, [trainerId]);

  // Don't render if not a verified trainer (pending trainers see nothing)
  if (isVerifiedTrainer === false) return null;
  // Show nothing while checking (avoids flash)
  if (isVerifiedTrainer === null) return null;

  // Form state
  const [body, setBody] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── File handlers ────────────────────────────────────────────────────────
  const handleFile = useCallback((f: File) => {
    if (!ACCEPTED.includes(f.type)) {
      toast.error("Unsupported file type. Please upload a video (MP4, MOV, WebM) or image.");
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast.error("File too large. Maximum size is 200 MB.");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);

  const removeFile = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setUploadProgress(0);
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const submitMut = useMutation({
    mutationFn: async () => {
      let mediaUrls: string[] = [];

      if (file) {
        setUploading(true);
        setUploadProgress(0);
        try {
          const ext = file.name.split(".").pop() || "bin";
          const path = `${trainerId}/coaching-replies/${postId}-${crypto.randomUUID()}.${ext}`;

          const { error: upErr } = await supabase.storage
            .from("post-media")
            .upload(path, file, { contentType: file.type });

          if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

          setUploadProgress(80);

          const { data: signed, error: signErr } = await supabase.storage
            .from("post-media")
            .createSignedUrl(path, 60 * 60 * 24 * 365 * 10); // 10-year signed URL

          if (signErr || !signed?.signedUrl)
            throw new Error(`Could not generate media URL: ${signErr?.message ?? "unknown"}`);

          setUploadProgress(100);
          mediaUrls = [signed.signedUrl];
        } finally {
          setUploading(false);
        }
      }

      return addFn({
        data: {
          postId,
          body: body.trim(),
          mediaUrls,
          isPrivate,
        },
      });
    },
    onSuccess: () => {
      setBody("");
      removeFile();
      setIsPrivate(true);
      onSuccess();
      toast.success("Coaching response posted.");
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const isVideo = file?.type.startsWith("video/");
  const canSubmit = (body.trim().length > 0 || file !== null) && !submitMut.isPending && !uploading;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
            <VideoIcon className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            {coachingStatus === "pending"
              ? "Step 2: Primary Feedback"
              : coachingStatus === "coached"
                ? "Step 4: Final Answer"
                : "Coaching Response"}
          </span>
        </div>

        {/* Privacy toggle */}
        <button
          type="button"
          onClick={() => setIsPrivate((v) => !v)}
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest transition-all duration-200 ${
            isPrivate
              ? "bg-amber-500/15 text-amber-600 hover:bg-amber-500/25"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
          title={isPrivate ? "Private — only subscriber can see this" : "Public — everyone can see this"}
        >
          {isPrivate ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
          {isPrivate ? "Private" : "Public"}
        </button>
      </div>

      {/* Privacy info */}
      {isPrivate && (
        <p className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
          🔒 Only the subscriber who asked this question can see your response.
        </p>
      )}

      {/* Media Drop Zone */}
      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`mb-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-5 text-center transition-all duration-200 ${
            isDragging
              ? "border-primary bg-primary/10 scale-[1.01]"
              : "border-border bg-background/50 hover:border-primary/50 hover:bg-primary/5"
          }`}
        >
          <FileVideo className="h-7 w-7 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Attach video or image</span>
            <br />
            MP4, MOV, WebM, JPG, PNG · Max 200 MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <div className="mb-3 overflow-hidden rounded-lg border border-border bg-background/50">
          {/* Media preview */}
          <div className="relative aspect-video w-full bg-black">
            {isVideo ? (
              <video
                src={preview!}
                controls
                className="h-full w-full object-contain"
                playsInline
              />
            ) : (
              <img
                src={preview!}
                alt="Attachment preview"
                className="h-full w-full object-contain"
              />
            )}

            {/* Remove button */}
            <button
              type="button"
              onClick={removeFile}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-opacity hover:bg-black/80"
              title="Remove media"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Upload progress */}
          {uploading && (
            <div className="px-3 py-2">
              <div className="mb-1 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                <span>Uploading…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* File info */}
          {!uploading && (
            <div className="flex items-center gap-2 px-3 py-2">
              <FileVideo className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate text-xs text-muted-foreground">
                {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
              </span>
            </div>
          )}
        </div>
      )}

      {/* Text area */}
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Describe your coaching analysis, form corrections, or instructions…"
        rows={3}
        maxLength={4000}
        className="mb-2 resize-none text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
            e.preventDefault();
            submitMut.mutate();
          }
        }}
      />

      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {body.length}/4000 · ⌘/Ctrl+Enter
        </span>
        <Button
          size="sm"
          disabled={!canSubmit}
          onClick={() => submitMut.mutate()}
          className="rounded-full bg-primary uppercase tracking-widest text-white transition-transform hover:scale-105 active:scale-95"
        >
          {submitMut.isPending || uploading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="mr-1.5 h-3.5 w-3.5" />
          )}
          Post Response
        </Button>
      </div>
    </div>
  );
}
