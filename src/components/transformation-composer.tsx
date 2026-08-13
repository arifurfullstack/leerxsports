import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Loader2, X, Camera, Eye, Lock, Globe, Shield, Tag, HelpCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTransformation } from "@/lib/transformation-functions";

type Angle = "front" | "side" | "back" | "other";
type Visibility = "public" | "subscribers" | "private";

const ANGLES: { value: Angle; label: string; icon: string }[] = [
  { value: "front", label: "Front", icon: "📷" },
  { value: "side", label: "Side", icon: "📐" },
  { value: "back", label: "Back", icon: "🔙" },
  { value: "other", label: "Other", icon: "✨" },
];

const VISIBILITIES: { value: Visibility; label: string; desc: string; icon: any }[] = [
  { value: "public", label: "Public", desc: "Visible on community feed", icon: Globe },
  { value: "subscribers", label: "Trainer Only", desc: "Visible to my pro trainer", icon: Lock },
  { value: "private", label: "Private", desc: "Visible only to me", icon: Shield },
];

const BF_CHIPS = ["8", "12", "15", "18", "22", "25"];
const NOTE_TAGS = ["#Cut", "#Bulk", "#Recomp", "#PR", "#Week4", "#MorningCheck", "#LegDay"];

function parseErrorMessage(err: Error | string): string {
  const msg = typeof err === "string" ? err : err.message;
  if (!msg) return "An error occurred while saving.";

  if (msg.trim().startsWith("[") && msg.trim().endsWith("]")) {
    try {
      const parsed = JSON.parse(msg);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0];
        const fieldName = first.path?.[0];
        const fieldMap: Record<string, string> = {
          body_fat_percent: "Body Fat %",
          weight_kg: "Weight",
          captured_on: "Captured date",
          view_angle: "View angle",
          visibility: "Visibility",
        };
        const label = fieldMap[fieldName] ?? fieldName ?? "Field";

        if (first.code === "too_big") {
          return `${label} must be ${first.maximum}${fieldName === "body_fat_percent" ? "%" : " kg"} or less.`;
        }
        if (first.code === "too_small") {
          return `${label} must be at least ${first.minimum}${fieldName === "body_fat_percent" ? "%" : " kg"}.`;
        }
        return `${label}: ${first.message}`;
      }
    } catch {
      /* fallback */
    }
  }
  return msg;
}

export function TransformationComposer({ userId }: { userId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [angle, setAngle] = useState<Angle>("front");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [capturedOn, setCapturedOn] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [weight, setWeight] = useState("");
  const [bf, setBf] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();
  const createFn = useServerFn(createTransformation);

  const submit = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a photo or short video first.");
      if (bf && (Number(bf) < 1 || Number(bf) > 70)) {
        throw new Error("Body Fat % must be between 1% and 70%.");
      }
      if (weight && (Number(weight) < 20 || Number(weight) > 400)) {
        throw new Error("Weight must be between 20 kg and 400 kg.");
      }

      setUploading(true);
      setError(null);
      try {
        const ext = file.name.split(".").pop() || "bin";
        const path = `transformations/${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("post-media")
          .upload(path, file, { contentType: file.type });
        if (upErr) throw new Error(upErr.message);

        await createFn({
          data: {
            kind: file.type.startsWith("video/") ? "video" : "photo",
            media_path: path,
            view_angle: angle,
            captured_on: capturedOn,
            weight_kg: weight ? Number(weight) : null,
            body_fat_percent: bf ? Number(bf) : null,
            notes: notes.trim() || null,
            visibility,
          },
        });
      } finally {
        setUploading(false);
      }
    },
    onSuccess: () => {
      setFile(null);
      setPreview(null);
      setNotes("");
      setWeight("");
      setBf("");
      setError(null);
      qc.invalidateQueries({ queryKey: ["my-transformations"] });
      toast.success("Transformation logged successfully 🚀");
    },
    onError: (e: Error) => {
      const clean = parseErrorMessage(e);
      setError(clean);
      toast.error(clean);
    },
  });

  const handleFile = (f: File | null) => {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
    setError(null);
  };

  const appendTag = (tag: string) => {
    setNotes((prev) => {
      if (!prev.trim()) return tag;
      if (prev.includes(tag)) return prev;
      return `${prev.trim()} ${tag}`;
    });
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-black/80 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_0_50px_-20px_rgba(16,185,129,0.25)] space-y-6 transition-all duration-500">
      {/* Decorative ambient background glows */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />

      {/* Header */}
      <div className="relative flex items-center justify-between border-b border-hairline/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-sky-500/15 to-purple-600/20 border border-emerald-500/30 text-emerald-400 shadow-md">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold uppercase tracking-widest text-foreground">Log a Transformation</h2>
            <p className="text-xs text-muted-foreground">Record your physique progress with a photo or short video. Include accurate date &amp; metrics.</p>
          </div>
        </div>
      </div>

      <div className="relative grid gap-6 lg:grid-cols-[230px_1fr]">
        {/* Upload Dropzone */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-foreground/90 flex items-center gap-1.5">
            <Upload className="h-3.5 w-3.5 text-emerald-400" /> Physique Photo / Video
          </Label>
          <label
            htmlFor="tx-file"
            className={`relative flex aspect-[3/4] sm:aspect-square lg:aspect-[3/4] w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 ${
              preview
                ? "border-emerald-500/80 bg-black/90 shadow-[0_0_25px_-5px_rgba(16,185,129,0.3)]"
                : "border-emerald-500/30 bg-neutral-900/60 hover:border-emerald-400 hover:bg-emerald-500/10 hover:shadow-[0_0_20px_-5px_rgba(16,185,129,0.2)]"
            }`}
          >
            {preview ? (
              file?.type.startsWith("video/") ? (
                <video src={preview} className="h-full w-full object-cover" muted autoPlay loop />
              ) : (
                <img src={preview} alt="preview" className="h-full w-full object-cover" loading="lazy" decoding="async" />
              )
            ) : (
              <div className="flex flex-col items-center p-4 text-center text-muted-foreground group">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 transition-transform duration-300 group-hover:scale-110 group-hover:bg-emerald-500/25">
                  <Upload className="h-6 w-6" />
                </div>
                <span className="mt-3 text-xs font-bold text-foreground">Click to upload</span>
                <span className="mt-1 text-[10px] text-muted-foreground/80">Photo or MP4 Video (Max 50MB)</span>
              </div>
            )}
            <input
              id="tx-file"
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
                className="absolute right-2 top-2 rounded-full border border-white/20 bg-black/80 p-1.5 text-white backdrop-blur-md transition-all hover:scale-110 hover:bg-rose-600/80"
                aria-label="Remove"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
        </div>

        {/* Form Fields & Suggestions */}
        <div className="space-y-5">
          {/* Angle & Date Pills Row */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="captured" className="text-xs font-bold uppercase tracking-wider text-foreground/90">Captured On</Label>
              <Input
                id="captured"
                type="date"
                value={capturedOn}
                onChange={(e) => setCapturedOn(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="h-11 rounded-2xl border-border/80 bg-neutral-900/80 px-4 text-xs font-medium text-foreground transition-all duration-300 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 shadow-inner"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-foreground/90">View Angle</Label>
              <div className="flex flex-wrap gap-2">
                {ANGLES.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setAngle(a.value)}
                    className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all duration-200 hover:scale-105 active:scale-95 ${
                      angle === a.value
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)]"
                        : "border-border/60 bg-neutral-900/60 text-muted-foreground hover:border-emerald-500/50 hover:text-foreground"
                    }`}
                  >
                    <span>{a.icon}</span> {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Metrics Grid with Smart Chips */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="w" className="text-xs font-bold uppercase tracking-wider text-foreground/90">Weight (kg)</Label>
                <span className="text-[10px] text-muted-foreground">Range: 20 – 400 kg</span>
              </div>
              <Input
                id="w"
                type="number"
                step="0.1"
                placeholder="e.g. 75.5"
                value={weight}
                onChange={(e) => {
                  setWeight(e.target.value);
                  setError(null);
                }}
                className="h-11 rounded-2xl border-border/80 bg-neutral-900/80 px-4 text-xs font-medium text-foreground transition-all duration-300 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 shadow-inner"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="bf" className="text-xs font-bold uppercase tracking-wider text-foreground/90">Body Fat %</Label>
                <span className="text-[10px] text-muted-foreground">Range: 1 – 70%</span>
              </div>
              <Input
                id="bf"
                type="number"
                step="0.1"
                placeholder="e.g. 15.0"
                value={bf}
                onChange={(e) => {
                  setBf(e.target.value);
                  setError(null);
                }}
                className="h-11 rounded-2xl border-border/80 bg-neutral-900/80 px-4 text-xs font-medium text-foreground transition-all duration-300 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 shadow-inner"
              />

              {/* Body Fat Chips Suggestions */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Quick Chips:
                </span>
                {BF_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      setBf(chip);
                      setError(null);
                    }}
                    className={`rounded-xl border px-2.5 py-0.5 text-[10px] font-bold transition-all duration-200 hover:scale-105 active:scale-95 ${
                      bf === chip
                        ? "border-emerald-400 bg-emerald-500 text-black shadow-[0_0_15px_-3px_rgba(16,185,129,0.5)]"
                        : "border-border/60 bg-neutral-900/60 text-muted-foreground hover:border-emerald-500/50 hover:text-foreground"
                    }`}
                  >
                    {chip}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notes & Related Hashtag Suggestions */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="notes" className="text-xs font-bold uppercase tracking-wider text-foreground/90">Notes &amp; Observations</Label>
              <span className="text-[10px] text-muted-foreground">Include workout context or feel</span>
            </div>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-2xl border-border/80 bg-neutral-900/80 p-3.5 text-xs text-foreground placeholder:text-muted-foreground/60 transition-all duration-300 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 shadow-inner"
              placeholder="How are you feeling? What changed in your workout routine or nutrition?"
            />

            {/* Related Hashtag Suggestions */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <Tag className="h-3 w-3" /> Suggested Tags:
              </span>
              {NOTE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => appendTag(tag)}
                  className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-all duration-200 hover:border-emerald-500/60 hover:bg-emerald-500/15 hover:text-emerald-300 hover:scale-105 active:scale-95 shadow-sm"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Visibility Pill Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-foreground/90">Privacy &amp; Visibility</Label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {VISIBILITIES.map((v) => {
                const Icon = v.icon;
                return (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => setVisibility(v.value)}
                    className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                      visibility === v.value
                        ? "border-emerald-400/60 bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent text-emerald-300 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]"
                        : "border-border/60 bg-neutral-900/60 text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold">{v.label}</p>
                      <p className="text-[10px] opacity-80">{v.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error Message Box */}
          {error && (
            <div className="flex items-center gap-2 rounded-2xl border border-destructive/50 bg-destructive/10 p-3.5 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-hairline/60">
            <Button
              type="button"
              onClick={() => submit.mutate()}
              disabled={!file || uploading || submit.isPending}
              className="rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-7 py-2.5 font-bold uppercase tracking-wider text-black shadow-[0_0_25px_-5px_rgba(16,185,129,0.5)] transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-[0_0_35px_-5px_rgba(16,185,129,0.7)] disabled:opacity-50"
            >
              {uploading || submit.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Transformation…
                </>
              ) : (
                "Save Transformation"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}