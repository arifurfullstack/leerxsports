import { useCallback, useEffect, useId, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import {
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";

export type UploadProgress = (pct: number, phase: "cropping" | "uploading" | "finalizing") => void;

export type AvatarSize = { key: "sm" | "md" | "lg"; px: number };
export const AVATAR_SIZES: AvatarSize[] = [
  { key: "sm", px: 96 },   // navbar / tiles @ up to 2× 48px
  { key: "md", px: 256 },  // profile cards @ 128px display
  { key: "lg", px: 512 },  // large / retina profile hero
];
export type CroppedVariants = Record<AvatarSize["key"], Blob>;

interface Props {
  open: boolean;
  file: File | null;
  onClose: () => void;
  onCropped: (variants: CroppedVariants, onProgress: UploadProgress) => Promise<void>;
}

type Status =
  | { kind: "idle" }
  | { kind: "working"; phase: "cropping" | "uploading" | "finalizing"; pct: number }
  | { kind: "success" }
  | { kind: "error"; message: string };

const PHASE_LABEL: Record<"cropping" | "uploading" | "finalizing", string> = {
  cropping: "Resizing photo…",
  uploading: "Uploading…",
  finalizing: "Finalizing…",
};

export function AvatarCropperDialog({ open, file, onClose, onCropped }: Props) {
  const zoomId = useId();
  const rotationId = useId();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [areaPx, setAreaPx] = useState<Area | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const variantsRef = useRef<CroppedVariants | null>(null);
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!file) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setStatus({ kind: "idle" });
    variantsRef.current = null;
    attemptRef.current = 0;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_: Area, px: Area) => setAreaPx(px), []);

  // Debounced preview render — reuses getCroppedBlob so what you see is what uploads.
  useEffect(() => {
    if (!imageUrl || !areaPx) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    const t = window.setTimeout(async () => {
      try {
        const blob = await getCroppedBlob(imageUrl, areaPx, rotation, 256);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return objectUrl;
        });
      } catch {
        /* preview only — ignore */
      }
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [imageUrl, areaPx, rotation]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    if (!imageUrl || !areaPx) return;
    const isRetry = attemptRef.current > 0 && variantsRef.current !== null;
    attemptRef.current += 1;
    setStatus({ kind: "working", phase: isRetry ? "uploading" : "cropping", pct: isRetry ? 5 : 5 });
    try {
      let variants: CroppedVariants;
      if (isRetry && variantsRef.current) {
        variants = variantsRef.current;
      } else {
        const built: Partial<CroppedVariants> = {};
        for (let i = 0; i < AVATAR_SIZES.length; i++) {
          const size = AVATAR_SIZES[i]!;
          built[size.key] = await getCroppedBlob(imageUrl, areaPx, rotation, size.px);
          setStatus({
            kind: "working",
            phase: "cropping",
            pct: ((i + 1) / AVATAR_SIZES.length) * 100,
          });
        }
        variants = built as CroppedVariants;
        variantsRef.current = variants;
      }
      setStatus({ kind: "working", phase: "uploading", pct: 10 });
      await onCropped(variants, (pct, phase) => {
        setStatus({ kind: "working", phase, pct: Math.max(0, Math.min(100, pct)) });
      });
      setStatus({ kind: "success" });
      // brief success flash, then close
      window.setTimeout(() => onClose(), 700);
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  }

  const busy = status.kind === "working";
  const done = status.kind === "success";
  const failed = status.kind === "error";
  const controlsDisabled = busy || done;

  const clampZoom = (v: number) => Math.min(4, Math.max(1, Math.round(v * 100) / 100));
  const wrapRotation = (v: number) => ((Math.round(v) % 360) + 360) % 360;

  const nudgeZoom = (delta: number) => setZoom((z) => clampZoom(z + delta));
  const nudgeRotation = (delta: number) => setRotation((r) => wrapRotation(r + delta));
  const resetTransforms = () => {
    setZoom(1);
    setRotation(0);
    setCrop({ x: 0, y: 0 });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o && !busy ? onClose() : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adjust your photo</DialogTitle>
        </DialogHeader>
        <div
          className="relative h-72 w-full overflow-hidden rounded-md bg-muted sm:h-80"
          role="img"
          aria-label="Avatar preview. Use the zoom and rotation controls below to adjust."
        >
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
              restrictPosition
            />
          )}
        </div>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={zoomId} className="flex items-center gap-2 text-xs font-medium">
                <ZoomIn className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Zoom
              </Label>
              <span className="text-xs tabular-nums text-muted-foreground" aria-hidden="true">
                {zoom.toFixed(2)}×
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-9 w-9 shrink-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onClick={() => nudgeZoom(-0.1)}
                disabled={controlsDisabled || zoom <= 1}
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Slider
                id={zoomId}
                value={[zoom]}
                min={1}
                max={4}
                step={0.01}
                onValueChange={(v) => setZoom(v[0] ?? 1)}
                className="flex-1"
                disabled={controlsDisabled}
                aria-label="Zoom level"
                aria-valuetext={`${zoom.toFixed(2)} times`}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-9 w-9 shrink-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onClick={() => nudgeZoom(0.1)}
                disabled={controlsDisabled || zoom >= 4}
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={rotationId} className="flex items-center gap-2 text-xs font-medium">
                <RotateCw className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Rotation
              </Label>
              <span className="text-xs tabular-nums text-muted-foreground" aria-hidden="true">
                {Math.round(rotation)}°
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-9 w-9 shrink-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onClick={() => nudgeRotation(-15)}
                disabled={controlsDisabled}
                aria-label="Rotate 15 degrees counter-clockwise"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Slider
                id={rotationId}
                value={[rotation]}
                min={0}
                max={360}
                step={1}
                onValueChange={(v) => setRotation(v[0] ?? 0)}
                className="flex-1"
                disabled={controlsDisabled}
                aria-label="Rotation in degrees"
                aria-valuetext={`${Math.round(rotation)} degrees`}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-9 w-9 shrink-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onClick={() => nudgeRotation(15)}
                disabled={controlsDisabled}
                aria-label="Rotate 15 degrees clockwise"
              >
                <RotateCw className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetTransforms}
              disabled={controlsDisabled || (zoom === 1 && rotation === 0 && crop.x === 0 && crop.y === 0)}
              aria-label="Reset zoom, rotation, and position"
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Reset
            </Button>
          </div>

          <div
            className="rounded-md border border-hairline bg-muted/40 p-3"
            aria-label="Live preview of how your avatar will appear across the app"
          >
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Live preview
            </p>
            <div className="flex items-end justify-around gap-3">
              <PreviewSample previewUrl={previewUrl} pixelSize={32} caption="Navbar" />
              <PreviewSample previewUrl={previewUrl} pixelSize={48} caption="Comments" />
              <PreviewSample previewUrl={previewUrl} pixelSize={96} caption="Card" />
              <PreviewSample previewUrl={previewUrl} pixelSize={128} caption="Profile" />
            </div>
          </div>

          {busy && (
            <div className="space-y-2" role="status" aria-live="polite">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {PHASE_LABEL[status.phase]}
                </span>
                <span className="tabular-nums">{Math.round(status.pct)}%</span>
              </div>
              <Progress value={status.pct} />
            </div>
          )}
          {done && (
            <div
              className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500"
              role="status"
              aria-live="polite"
            >
              <CheckCircle2 className="h-4 w-4" />
              Photo updated
            </div>
          )}
          {failed && (
            <div
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{status.message}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {done ? "Close" : "Cancel"}
          </Button>
          <Button onClick={handleSave} disabled={busy || done || !areaPx}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {failed && <RefreshCw className="mr-2 h-4 w-4" />}
            {failed
              ? `Retry${attemptRef.current > 1 ? ` (${attemptRef.current - 1})` : ""}`
              : done
                ? "Saved"
                : "Save photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewSample({
  previewUrl,
  pixelSize,
  caption,
}: {
  previewUrl: string | null;
  pixelSize: number;
  caption: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="overflow-hidden rounded-full bg-muted ring-1 ring-border"
        style={{ width: pixelSize, height: pixelSize }}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : null}
      </div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {caption}
      </span>
      <span className="text-[10px] tabular-nums text-muted-foreground/70">{pixelSize}px</span>
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function getCroppedBlob(
  imageSrc: string,
  area: Area,
  rotation: number,
  outputSize: number,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const rad = (rotation * Math.PI) / 180;

  // Draw rotated image on an off-screen canvas, then extract the cropped area.
  const safe = Math.ceil(Math.sqrt(image.width * image.width + image.height * image.height));
  const off = document.createElement("canvas");
  off.width = safe;
  off.height = safe;
  const octx = off.getContext("2d")!;
  octx.translate(safe / 2, safe / 2);
  octx.rotate(rad);
  octx.drawImage(image, -image.width / 2, -image.height / 2);

  // react-easy-crop returns area in the *original* image coordinates, but with
  // rotation applied it maps into the rotated canvas offset by (safe-width)/2.
  const dx = Math.floor((safe - image.width) / 2);
  const dy = Math.floor((safe - image.height) / 2);

  const out = document.createElement("canvas");
  out.width = outputSize;
  out.height = outputSize;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    off,
    area.x + dx,
    area.y + dy,
    area.width,
    area.height,
    0,
    0,
    outputSize,
    outputSize,
  );

  return new Promise<Blob>((resolve, reject) =>
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))),
      "image/jpeg",
      0.9,
    ),
  );
}