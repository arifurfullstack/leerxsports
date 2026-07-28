import { useRef, useState, type ReactNode } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { updateProfileSettings } from "@/lib/settings-functions";
import {
  validateAvatarFile,
  AVATAR_ACCEPT_ATTR,
} from "@/lib/avatar-validation";
import {
  AvatarCropperDialog,
  AVATAR_SIZES,
  type CroppedVariants,
} from "@/components/avatar-cropper-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const AVATAR_SIGNED_TTL = 60 * 60 * 24 * 365 * 5;

type Props = {
  children: ReactNode; // avatar visual
  hasAvatar?: boolean;
  onUpdated?: (urls: { sm: string; md: string; lg: string } | null) => void;
  className?: string;
  badgeClassName?: string;
  showRemove?: boolean;
};

function putWithProgress(
  url: string,
  body: Blob,
  contentType: string,
  onProgress: (bytesLoaded: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload aborted"));
    xhr.send(body);
  });
}

export function AvatarUploader({
  children,
  hasAvatar,
  onUpdated,
  className,
  badgeClassName,
  showRemove = true,
}: Props) {
  const qc = useQueryClient();
  const saveFn = useServerFn(updateProfileSettings);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function persist(urls: { sm: string; md: string; lg: string } | null) {
    await saveFn({ data: { avatar_url: urls?.lg ?? null, avatar_urls: urls } });
    qc.invalidateQueries({ queryKey: ["settings"] });
    qc.invalidateQueries({ queryKey: ["navbar-user"] });
    qc.invalidateQueries({ queryKey: ["onboarding-state"] });
    onUpdated?.(urls);
  }

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const result = await validateAvatarFile(file);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPendingFile(file);
  }

  async function uploadCropped(
    variants: CroppedVariants,
    onProgress: (pct: number, phase: "cropping" | "uploading" | "finalizing") => void,
  ) {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const stamp = Date.now();
      const items = AVATAR_SIZES.map((s) => ({
        key: s.key,
        blob: variants[s.key],
        path: `${user.id}/avatar-${stamp}-${s.px}.jpg`,
      }));
      const total = items.reduce((s, i) => s + i.blob.size, 0) || 1;
      const loaded: Record<string, number> = { sm: 0, md: 0, lg: 0 };
      const uploads = await Promise.all(
        items.map(async (it) => {
          const { data: signedUp, error } = await supabase.storage
            .from("avatars")
            .createSignedUploadUrl(it.path, { upsert: true });
          if (error || !signedUp?.signedUrl) throw error ?? new Error("Could not start upload");
          await putWithProgress(signedUp.signedUrl, it.blob, "image/jpeg", (b) => {
            loaded[it.key] = b;
            onProgress(((loaded.sm + loaded.md + loaded.lg) / total) * 100, "uploading");
          });
          return it;
        }),
      );
      onProgress(100, "finalizing");
      const signed = await Promise.all(
        uploads.map(async (it) => {
          const { data, error } = await supabase.storage
            .from("avatars")
            .createSignedUrl(it.path, AVATAR_SIGNED_TTL);
          if (error || !data?.signedUrl) throw error ?? new Error("Failed to sign URL");
          return { key: it.key, url: data.signedUrl };
        }),
      );
      const urls = signed.reduce(
        (a, c) => ({ ...a, [c.key]: c.url }),
        {} as { sm: string; md: string; lg: string },
      );
      await persist(urls);
      toast.success("Profile picture updated");
    } catch (err) {
      // Let the cropper dialog surface the error inline with a Retry button.
      throw err;
    } finally {
      setUploading(false);
    }
  }

  const removeMut = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: files } = await supabase.storage.from("avatars").list(user.id);
        if (files?.length) {
          await supabase.storage
            .from("avatars")
            .remove(files.map((f) => `${user.id}/${f.name}`));
        }
      }
      await persist(null);
    },
    onSuccess: () => {
      toast.success("Profile picture removed");
      setConfirmRemove(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className={cn("relative inline-flex", className)}>
      {children}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        aria-label="Change profile picture"
        title="Change profile picture"
        className={cn(
          "absolute -bottom-1 -right-1 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-lg shadow-primary/40 transition hover:scale-110 hover:shadow-primary/60 disabled:opacity-60 sm:h-9 sm:w-9",
          badgeClassName,
        )}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
      </button>
      {showRemove && hasAvatar && (
        <button
          type="button"
          onClick={() => setConfirmRemove(true)}
          disabled={uploading}
          aria-label="Remove profile picture"
          title="Remove profile picture"
          className="absolute -top-1 -right-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-background/90 text-muted-foreground shadow transition hover:bg-background hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={AVATAR_ACCEPT_ATTR}
        className="hidden"
        onChange={handlePick}
      />
      <AvatarCropperDialog
        open={!!pendingFile}
        file={pendingFile}
        onClose={() => setPendingFile(null)}
        onCropped={uploadCropped}
      />
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove profile picture?</AlertDialogTitle>
            <AlertDialogDescription>
              Your avatar will be deleted and replaced with your initials across LEER.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeMut.mutate()} disabled={removeMut.isPending}>
              {removeMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}