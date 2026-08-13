import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  UploadCloud,
  Loader2,
  X,
  Lock,
  Play,
  Image as ImageIcon,
  Send,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ShieldCheck,
  Gauge,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { createPost } from "@/lib/post-functions";
import { cn } from "@/lib/utils";

const MAX_CAPTION = 2000;
const MAX_BYTES = 100 * 1024 * 1024; // 100MB
const UPLOAD_MAX_ATTEMPTS = 3;

type Quota = {
  uploads_today: number;
  uploads_limit: number;
  uploads_remaining: number;
  storage_used: number;
  storage_limit: number;
  storage_remaining: number;
};

function formatBytes(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function humanizeUploadError(raw: unknown): { message: string; hint?: string; retriable: boolean } {
  const msg =
    (raw as { message?: string } | null)?.message ??
    (typeof raw === "string" ? raw : "Something went wrong.");
  const low = msg.toLowerCase();

  if (low.includes("row-level security") || low.includes("rls") || low.includes("permission denied") || low.includes("not authorized")) {
    return {
      message: "You don't have permission to publish yet.",
      hint: "Publishing is limited to Pro creators. Apply as a Pro to unlock uploads.",
      retriable: false,
    };
  }
  if (low.includes("daily_limit") || low.includes("daily upload limit")) {
    return {
      message: "You've hit today's upload limit.",
      hint: "The daily counter resets at 00:00 UTC. Come back tomorrow to publish more.",
      retriable: false,
    };
  }
  if (low.includes("storage_limit") || low.includes("storage cap")) {
    return {
      message: "You've used all your storage.",
      hint: "Delete older posts to free up space.",
      retriable: false,
    };
  }
  if (low.includes("payload too large") || low.includes("exceeded") || low.includes("too large")) {
    return { message: "That file is too large.", hint: "Max size is 100 MB.", retriable: false };
  }
  if (low.includes("duplicate") || low.includes("already exists")) {
    return { message: "That file was just uploaded.", hint: "Try again — we'll pick a fresh name.", retriable: true };
  }
  if (low.includes("mime") || low.includes("content type") || low.includes("invalid")) {
    return { message: "That file type isn't supported.", hint: "Use an image (JPG/PNG/WEBP) or video (MP4/MOV).", retriable: false };
  }
  if (low.includes("network") || low.includes("failed to fetch") || low.includes("timeout") || low.includes("timed out") || low.includes("aborted")) {
    return { message: "Network hiccup while uploading.", hint: "Check your connection — we'll retry automatically.", retriable: true };
  }
  if (low.includes("jwt") || low.includes("expired") || low.includes("unauthorized")) {
    return { message: "Your session expired.", hint: "Refresh the page and sign in again.", retriable: false };
  }
  if (low.includes("bucket") || low.includes("storage")) {
    return { message: "Storage is temporarily unavailable.", hint: "We'll retry in a moment.", retriable: true };
  }
  return { message: msg || "Something went wrong.", retriable: true };
}

type Step = "pick" | "edit" | "done";

export function CreatePostDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [isTrainer, setIsTrainer] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>("pick");
  const [kind, setKind] = useState<"feed" | "short">("feed");
  const [isPremium, setIsPremium] = useState(false);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [uploadPct, setUploadPct] = useState(0);
  const qc = useQueryClient();
  const createPostFn = useServerFn(createPost);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const captionRef = useRef<HTMLTextAreaElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const captionId = useId();
  const captionCountId = useId();
  const premiumLabelId = useId();
  const premiumDescId = useId();
  const kindGroupId = useId();

  const quotaQuery = useQuery<Quota | null>({
    queryKey: ["upload-quota", userId],
    enabled: open && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_upload_quota");
      if (error) throw error;
      return (data as unknown as Quota) ?? null;
    },
    staleTime: 15_000,
  });
  const quota = quotaQuery.data ?? null;

  useEffect(() => {
    if (!open) return;
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (!uid) {
        setIsTrainer(false);
        return;
      }
      const { count } = await supabase
        .from("trainer_profiles")
        .select("*", { count: "exact", head: true })
        .eq("user_id", uid);
      setIsTrainer(count ? count > 0 : false);
    });
  }, [open]);

  const resetAll = useCallback(() => {
    setStep("pick");
    setKind("feed");
    setIsPremium(false);
    setCaption("");
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    setError(null);
    setErrorHint(null);
    setCanRetry(false);
    setAttempt(0);
    setUploadPct(0);
  }, [preview]);

  useEffect(() => {
    if (!open) {
      // small delay so exit animation finishes before wiping
      const t = setTimeout(resetAll, 200);
      return () => clearTimeout(t);
    }
  }, [open, resetAll]);

  const handleFile = useCallback(
    (f: File | null) => {
      setError(null);
      setErrorHint(null);
      setCanRetry(false);
      if (!f) {
        if (preview) URL.revokeObjectURL(preview);
        setFile(null);
        setPreview(null);
        return;
      }
      if (f.size > MAX_BYTES) {
        setError("File too large. Max 100 MB.");
        return;
      }
      const isImg = f.type.startsWith("image/");
      const isVid = f.type.startsWith("video/");
      if (!isImg && !isVid) {
        setError("Only image or video files are supported.");
        return;
      }
      if (isVid) {
        const vid = document.createElement("video");
        vid.src = URL.createObjectURL(f);
        vid.onloadedmetadata = () => {
          if (vid.videoWidth > vid.videoHeight) {
            setError("Shorts must be vertical videos (portrait).");
            URL.revokeObjectURL(vid.src);
            return;
          }
          if (preview) URL.revokeObjectURL(preview);
          setFile(f);
          setPreview(vid.src);
          setKind("short");
          setStep("edit");
        };
        vid.onerror = () => {
          setError("Could not read video file.");
        };
        return;
      }
      
      if (preview) URL.revokeObjectURL(preview);
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setKind("feed");
      setStep("edit");
    },
    [preview],
  );

  const submit = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Please choose a file.");
      if (!userId) throw new Error("You must be signed in.");
      setError(null);
      setErrorHint(null);
      setCanRetry(false);
      setUploadPct(5);

      // Reserve a slot atomically before uploading a single byte.
      const { data: reserve, error: reserveErr } = await supabase.rpc("try_record_upload", {
        _bytes: file.size,
      });
      if (reserveErr) throw reserveErr;
      const r = reserve as unknown as Quota & { allowed: boolean; reason?: string };
      if (!r?.allowed) {
        const reason = r?.reason === "storage_limit" ? "storage_limit" : "daily_limit";
        throw new Error(reason);
      }

      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      let path = "";
      let lastErr: unknown = null;

      for (let i = 1; i <= UPLOAD_MAX_ATTEMPTS; i++) {
        setAttempt(i);
        path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("post-media")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (!upErr) {
          lastErr = null;
          break;
        }
        lastErr = upErr;
        const { retriable } = humanizeUploadError(upErr);
        if (!retriable || i === UPLOAD_MAX_ATTEMPTS) break;
        setUploadPct(5 + i * 5);
        await sleep(400 * Math.pow(2, i - 1));
      }
      if (lastErr) throw lastErr;
      setUploadPct(75);

      await createPostFn({
        data: {
          kind,
          is_premium: isPremium,
          caption: caption.trim() || null,
          media_path: path,
        },
      });
      setUploadPct(100);
    },
    onSuccess: () => {
      setStep("done");
      setAttempt(0);
      qc.invalidateQueries({ queryKey: ["my-posts"] });
      qc.invalidateQueries({ queryKey: ["user-posts"] });
      qc.invalidateQueries({ queryKey: ["trainee-posts"] });
      qc.invalidateQueries({ queryKey: ["trainer"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["home-feed"] });
      qc.invalidateQueries({ queryKey: ["upload-quota"] });
    },
    onError: (e: Error) => {
      const { message, hint, retriable } = humanizeUploadError(e);
      setError(message);
      setErrorHint(hint ?? null);
      setCanRetry(retriable);
      setUploadPct(0);
      // Refresh in case a reservation was consumed but upload later failed.
      qc.invalidateQueries({ queryKey: ["upload-quota"] });
    },
  });

  const captionLeft = MAX_CAPTION - caption.length;
  const publishing = submit.isPending;
  const noQuota = quota
    ? quota.uploads_remaining <= 0 ||
      (file ? file.size > quota.storage_remaining : quota.storage_remaining <= 0)
    : false;
  const canPublish =
    Boolean(file) && !publishing && captionLeft >= 0 && isTrainer !== false && !noQuota;

  // Focus caption when entering edit step.
  useEffect(() => {
    if (step === "edit") {
      const t = setTimeout(() => captionRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [step]);

  // Cmd/Ctrl+Enter to publish from anywhere in the edit step.
  useEffect(() => {
    if (step !== "edit") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (canPublish) submit.mutate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, canPublish, submit]);

  // Roving arrow-key selection for the Feed/Short radio group.
  const onKindKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      if (e.key === "Home") setKind("feed");
      else if (e.key === "End") setKind("short");
      else setKind((k) => (k === "feed" ? "short" : "feed"));
    }
  }, []);

  const dropHandlers = useMemo(
    () => ({
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
      },
      onDragLeave: () => setDragOver(false),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      },
    }),
    [handleFile],
  );

  return (
    <Dialog open={open} onOpenChange={publishing ? () => {} : onOpenChange}>
      <DialogContent
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={cn(
          "flex h-dvh max-h-dvh w-screen max-w-none flex-col overflow-hidden rounded-none border-0 bg-card/95 p-0 backdrop-blur-2xl transition-[max-width,height] duration-300",
          "sm:h-auto sm:max-h-[min(90dvh,720px)] sm:w-[calc(100vw-2rem)] sm:rounded-2xl sm:border sm:border-border/70",
          step === "edit" ? "sm:max-w-[780px] md:max-w-[840px]" : "sm:max-w-[560px]",
          "shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]",
        )}
      >
        <VisuallyHidden>
          <DialogTitle id={titleId}>Create post</DialogTitle>
          <DialogDescription id={descId}>
            Upload an image or video, add a caption, then publish. Press Command or Control plus Enter to publish.
          </DialogDescription>
        </VisuallyHidden>

        {/* Header */}
        <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 bg-gradient-to-r from-primary/10 via-transparent to-primary/5 px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:flex sm:justify-between sm:px-4 sm:py-3">
          <div className="flex min-w-0 items-center gap-3">
            {step === "edit" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 sm:h-8 sm:w-8"
                onClick={() => {
                  handleFile(null);
                  setStep("pick");
                }}
                aria-label="Back to media picker"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                {step === "done" ? "Published" : step === "edit" ? "Review & publish" : "New post"}
              </p>
              <h2 className="truncate font-display text-sm leading-tight text-foreground sm:text-base">
                {step === "done"
                  ? "Your post is live"
                  : step === "edit"
                  ? "Craft the details"
                  : "Share something bold"}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StepDots step={step} />
          </div>
        </div>

        {/* Quota strip */}
        {quota && step !== "done" && (
          <div
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border/60 bg-background/50 px-3 py-1.5 text-[11px] text-muted-foreground sm:px-4"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2">
              <Gauge className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span>
                <strong className="text-foreground">{quota.uploads_remaining}</strong>
                <span className="mx-1">/</span>
                {quota.uploads_limit} uploads left today
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>
                <strong className="text-foreground">{formatBytes(quota.storage_remaining)}</strong>
                <span className="text-muted-foreground/80"> of {formatBytes(quota.storage_limit)} free</span>
              </span>
              <div
                className="hidden h-1 w-20 overflow-hidden rounded-full bg-muted sm:block"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={quota.storage_limit}
                aria-valuenow={quota.storage_used}
                aria-label="Storage used"
              >
                <div
                  className="h-full bg-primary transition-[width]"
                  style={{
                    width: `${Math.min(100, (quota.storage_used / Math.max(1, quota.storage_limit)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {quota && noQuota && step !== "done" && (
          <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive sm:px-5" role="alert">
            {quota.uploads_remaining <= 0
              ? "You've reached today's upload limit — it resets at 00:00 UTC."
              : "This file would exceed your storage cap. Delete older posts or pick a smaller file."}
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
        {step === "pick" && isTrainer === false && (
          <div className="p-5 sm:p-6">
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-background/60 p-8 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-xl text-foreground">Publishing is for Pro creators</h3>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                  Your account isn't a Pro creator yet. Apply as a Pro to publish posts, shorts and
                  reach subscribers.
                </p>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <Button asChild>
                  <Link to="/dashboard" onClick={() => onOpenChange(false)}>
                    Apply as a Pro
                  </Link>
                </Button>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Not now
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "pick" && isTrainer !== false && (
          <div className="p-3 sm:p-4">
            <label
              htmlFor="cp-file"
              {...dropHandlers}
              tabIndex={0}
              role="button"
              aria-label="Choose an image or video to upload. Press Enter to open the file picker, or drop a file here."
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              className={cn(
                "group relative flex min-h-[48vh] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-6 text-center transition-all sm:min-h-[240px]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                dragOver
                  ? "border-primary bg-primary/10"
                  : "border-border/70 bg-background/60 hover:border-primary/70 hover:bg-primary/5",
              )}
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary transition group-hover:scale-105">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-bold text-foreground">
                <span className="sm:hidden">Tap to choose a file</span>
                <span className="hidden sm:inline">Drag &amp; drop or click to upload</span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                JPG · PNG · WEBP · MP4 · MOV — up to 100 MB
              </p>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2 py-0.5">
                  <ImageIcon className="h-3 w-3" /> Feed
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2 py-0.5">
                  <Play className="h-3 w-3" /> Short
                </span>
              </div>
              <input
                ref={inputRef}
                id="cp-file"
                type="file"
                accept="image/*,video/*"
                className="sr-only"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {error && (
              <ErrorRow msg={error} />
            )}
          </div>
        )}

        {step === "edit" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canPublish) submit.mutate();
            }}
            className="grid gap-0 grid-cols-1 md:grid-cols-[minmax(0,48%)_minmax(0,52%)]"
          >
            {/* Preview */}
            <div className="relative flex items-center justify-center bg-black/60 p-3 md:min-h-[400px]">
              <div className="relative flex w-full items-center justify-center">
                {preview ? (
                  file?.type.startsWith("video/") ? (
                    <video
                      src={preview}
                      className="mx-auto max-h-[35vh] w-full rounded-xl object-contain md:max-h-[400px]"
                      controls
                      playsInline
                    />
                  ) : (
                    <img
                      src={preview}
                      alt="Selected media preview"
                      className="mx-auto max-h-[35vh] w-full rounded-xl object-contain md:max-h-[400px]"
                    />
                  )
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    handleFile(null);
                    setStep("pick");
                  }}
                  className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-background/80 text-foreground shadow backdrop-blur transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-8 sm:w-8"
                  aria-label="Remove selected media and choose another"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="flex flex-col gap-3 p-3 sm:p-4">
              <div>
                <p id={kindGroupId} className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Type
                </p>
                <div
                  role="radiogroup"
                  aria-labelledby={kindGroupId}
                  onKeyDown={onKindKeyDown}
                  className="grid grid-cols-2 gap-2"
                >
                  <SegBtn
                    active={kind === "feed"}
                    onClick={() => setKind("feed")}
                    icon={<ImageIcon className="h-3.5 w-3.5" />}
                    label="Feed"
                  />
                  <SegBtn
                    active={kind === "short"}
                    onClick={() => setKind("short")}
                    icon={<Play className="h-3.5 w-3.5" />}
                    label="Short"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor={captionId}
                    className="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
                  >
                    Caption
                  </label>
                  <span
                    id={captionCountId}
                    aria-live="polite"
                    className={cn(
                      "text-[10px] tabular-nums",
                      captionLeft < 0
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {captionLeft} left
                  </span>
                </div>
                <Textarea
                  id={captionId}
                  ref={captionRef}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write something bold. Add #hashtags and @mentions."
                  rows={3}
                  aria-describedby={captionCountId}
                  aria-invalid={captionLeft < 0}
                  className="resize-none rounded-xl border-border/60 bg-background/60 text-sm"
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 p-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p id={premiumLabelId} className="truncate text-[13px] font-bold text-foreground">Premium</p>
                    <p id={premiumDescId} className="truncate text-[11px] text-muted-foreground">
                      Subscribers only
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isPremium}
                  onCheckedChange={setIsPremium}
                  aria-labelledby={premiumLabelId}
                  aria-describedby={premiumDescId}
                />
              </div>

              {error && (
                <div role="alert">
                  <ErrorRow
                    msg={error}
                    hint={errorHint}
                    onRetry={canRetry ? () => submit.mutate() : undefined}
                  />
                </div>
              )}

              {publishing && (
                <div
                  className="rounded-xl border border-border/60 bg-background/60 p-3"
                  role="status"
                  aria-live="polite"
                >
                  <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <span>
                      {attempt > 1
                        ? `Retrying upload (attempt ${attempt}/${UPLOAD_MAX_ATTEMPTS})…`
                        : "Publishing…"}
                    </span>
                    <span className="tabular-nums">{uploadPct}%</span>
                  </div>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={uploadPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Upload progress"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-300"
                      style={{ width: `${uploadPct}%` }}
                    />
                  </div>
                </div>
              )}
              {/* Submit is in the sticky footer below (form still submits on Enter). */}
              <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
                Publish
              </button>
            </div>
          </form>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-10 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h3 className="font-display text-xl text-foreground">Post published</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Your {kind === "short" ? "short" : "post"} is now visible to your audience.
              </p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  resetAll();
                }}
              >
                Post another
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        )}
        </div>
        {/* /scrollable body */}

        {step === "edit" && (
          <div className="sticky bottom-0 z-10 flex items-center justify-between gap-2 border-t border-border/60 bg-card/95 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={publishing}
              className="min-h-10"
            >
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              <span className="hidden text-[10px] font-black uppercase tracking-widest text-muted-foreground sm:inline">
                ⌘/Ctrl + Enter
              </span>
              <Button
                type="button"
                size="sm"
                onClick={() => submit.mutate()}
                disabled={!canPublish}
                className="min-h-10 min-w-[128px]"
              >
                {publishing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" /> Publish
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepDots({ step }: { step: Step }) {
  const order: Step[] = ["pick", "edit", "done"];
  const idx = order.indexOf(step);
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {order.map((s, i) => (
        <span
          key={s}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i <= idx ? "w-6 bg-primary" : "w-3 bg-muted",
          )}
        />
      ))}
    </div>
  );
}

function SegBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-widest transition",
        active
          ? "border-primary/60 bg-primary/10 text-foreground shadow-[0_0_0_1px_var(--primary)]"
          : "border-border/60 bg-background/60 text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ErrorRow({
  msg,
  hint,
  onRetry,
}: {
  msg: string;
  hint?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="mt-3 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-bold">{msg}</p>
        {hint && <p className="mt-0.5 text-destructive/80">{hint}</p>}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-md border border-destructive/40 bg-background/40 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-destructive transition hover:bg-destructive/20"
        >
          Retry
        </button>
      )}
    </div>
  );
}