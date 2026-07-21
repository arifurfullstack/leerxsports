import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTransformation } from "@/lib/transformation-functions";

type Angle = "front" | "side" | "back" | "other";
type Visibility = "public" | "subscribers" | "private";

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
      if (!file) throw new Error("Choose a photo or video first.");
      setUploading(true);
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
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleFile = (f: File | null) => {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-display text-lg uppercase tracking-widest">
        Log a Transformation
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Record your progress with a photo or short video. Include the exact date
        so your timeline stays honest.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr]">
        <label
          htmlFor="tx-file"
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
              className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-foreground"
              aria-label="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </label>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="captured">Captured on</Label>
              <Input
                id="captured"
                type="date"
                value={capturedOn}
                onChange={(e) => setCapturedOn(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>View angle</Label>
              <select
                value={angle}
                onChange={(e) => setAngle(e.target.value as Angle)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="front">Front</option>
                <option value="side">Side</option>
                <option value="back">Back</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label htmlFor="w">Weight (kg)</Label>
              <Input
                id="w"
                type="number"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="bf">Body fat %</Label>
              <Input
                id="bf"
                type="number"
                step="0.1"
                value={bf}
                onChange={(e) => setBf(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1"
              placeholder="How are you feeling? What changed?"
            />
          </div>
          <div>
            <Label>Visibility</Label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Visibility)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="public">Public — anyone can see</option>
              <option value="subscribers">Trainer-only (subscribers)</option>
              <option value="private">Private — only me</option>
            </select>
          </div>

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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
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