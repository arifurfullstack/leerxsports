export const AVATAR_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
export const AVATAR_ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"] as const;
export const AVATAR_MAX_BYTES = 4 * 1024 * 1024; // 4 MB
export const AVATAR_MIN_DIMENSION = 96; // px, per shortest side
export const AVATAR_ACCEPT_ATTR = AVATAR_ALLOWED_TYPES.join(",");

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function loadImage(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file doesn't look like a valid image. Try a JPG, PNG, WEBP, or GIF."));
    };
    img.src = url;
  });
}

export type AvatarValidationResult =
  | { ok: true; width: number; height: number }
  | { ok: false; error: string };

/** Validate an avatar file with friendly, user-facing error messages. */
export async function validateAvatarFile(file: File): Promise<AvatarValidationResult> {
  if (file.size === 0) {
    return { ok: false, error: "This file is empty. Please pick another image." };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return {
      ok: false,
      error: `Image is ${formatBytes(file.size)}. Please choose a picture under ${formatBytes(AVATAR_MAX_BYTES)}.`,
    };
  }
  const typeOk = (AVATAR_ALLOWED_TYPES as readonly string[]).includes(file.type);
  const extOk = (AVATAR_ALLOWED_EXTENSIONS as readonly string[]).includes(extOf(file.name));
  if (!typeOk && !extOk) {
    return {
      ok: false,
      error: "Unsupported file type. Please upload a JPG, PNG, WEBP, or GIF.",
    };
  }
  try {
    const { width, height } = await loadImage(file);
    const shortest = Math.min(width, height);
    if (shortest < AVATAR_MIN_DIMENSION) {
      return {
        ok: false,
        error: `Image is too small (${width}×${height}). Please use at least ${AVATAR_MIN_DIMENSION}×${AVATAR_MIN_DIMENSION} pixels.`,
      };
    }
    return { ok: true, width, height };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not read image." };
  }
}