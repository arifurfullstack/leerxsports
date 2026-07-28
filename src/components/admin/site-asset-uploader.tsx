import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { uploadSiteAssetServer } from "@/lib/site-settings-functions";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

type Props = {
  kind: "favicon" | "logo" | "logo_dark" | "og";
  accept?: string;
  onUploaded: (url: string) => void;
  disabled?: boolean;
};

const DEFAULT_ACCEPT: Record<Props["kind"], string> = {
  favicon: "image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml",
  logo: "image/png,image/jpeg,image/webp,image/svg+xml",
  logo_dark: "image/png,image/jpeg,image/webp,image/svg+xml",
  og: "image/png,image/jpeg,image/webp",
};

export function SiteAssetUploader({ kind, accept, onUploaded, disabled }: Props) {
  const uploadFn = useServerFn(uploadSiteAssetServer);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error(`File too large. Max ${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB.`);
      return;
    }
    setBusy(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      const res = await uploadFn({
        data: {
          kind,
          filename: file.name,
          contentType: file.type || "image/png",
          base64,
        },
      });

      if (res?.ok && res.url) {
        onUploaded(res.url);
        toast.success("Asset uploaded successfully");
      } else {
        throw new Error("Failed to upload asset");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="mr-2 h-3.5 w-3.5" />
        )}
        Upload
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept ?? DEFAULT_ACCEPT[kind]}
        className="hidden"
        onChange={handlePick}
      />
    </>
  );
}
