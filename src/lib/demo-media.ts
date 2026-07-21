// Demo media pipeline: variant sizing + graceful placeholder fallback.
//
// Every URL that goes into the demo dataset flows through `resolveMedia()`
// so it renders at a size appropriate to its slot (avatar, thumb, feed,
// cover) and falls back to a deterministic Picsum placeholder when the
// source URL is missing or the host is unreachable.

export type MediaVariant = "avatar" | "thumb" | "feed" | "cover";

const VARIANT_WIDTH: Record<MediaVariant, number> = {
  avatar: 400,
  thumb: 640,
  feed: 1200,
  cover: 1600,
};

// Candidate widths per slot for `srcset`. Kept small so mobile fetches the
// smallest reasonable asset while retina/desktop can opt into larger ones.
const VARIANT_SRCSET: Record<MediaVariant, readonly number[]> = {
  avatar: [96, 160, 240, 400],
  thumb: [240, 400, 640, 960],
  feed: [480, 768, 1024, 1200, 1600],
  cover: [640, 960, 1280, 1600, 1920],
};

// Reasonable default `sizes` value per slot for a fluid grid layout.
const VARIANT_SIZES: Record<MediaVariant, string> = {
  avatar: "(min-width: 1024px) 96px, (min-width: 640px) 80px, 64px",
  thumb: "(min-width: 1024px) 320px, (min-width: 640px) 45vw, 90vw",
  feed: "(min-width: 1024px) 720px, (min-width: 640px) 80vw, 100vw",
  cover: "100vw",
};

function heightFor(variant: MediaVariant, w: number): number {
  return variant === "avatar" ? w : Math.round(w * 0.66);
}

function rewriteAt(url: string, variant: MediaVariant, w: number): string | null {
  try {
    const u = new URL(url);
    const h = heightFor(variant, w);
    if (u.hostname === "images.unsplash.com") {
      u.searchParams.set("w", String(w));
      u.searchParams.set("q", "80");
      u.searchParams.set("auto", "format");
      u.searchParams.set("fit", "crop");
      return u.toString();
    }
    if (u.hostname === "picsum.photos") {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "seed" && parts.length >= 2) {
        u.pathname = `/seed/${parts[1]}/${w}/${h}`;
      } else {
        u.pathname = `/${w}/${h}`;
      }
      return u.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export interface ResponsiveMedia {
  src: string;
  srcSet?: string;
  sizes?: string;
  width: number;
  height: number;
}

/**
 * Build a `src` + `srcset` + `sizes` triple for a demo asset. Falls back to
 * a single-URL result when the host isn't a known image CDN or when the URL
 * points at a video.
 */
export function buildResponsive(
  url: string | null | undefined,
  variant: MediaVariant,
  seed: string,
  sizes?: string,
): ResponsiveMedia {
  const base = resolveMedia(url, variant, seed);
  const baseW = VARIANT_WIDTH[variant];
  const baseH = heightFor(variant, baseW);
  if (isVideo(base)) {
    return { src: base, width: baseW, height: baseH };
  }
  const candidates = VARIANT_SRCSET[variant]
    .map((w) => {
      const rewritten = rewriteAt(base, variant, w);
      return rewritten ? `${rewritten} ${w}w` : null;
    })
    .filter((v): v is string => !!v);
  if (candidates.length === 0) {
    return { src: base, width: baseW, height: baseH };
  }
  return {
    src: base,
    srcSet: candidates.join(", "),
    sizes: sizes ?? VARIANT_SIZES[variant],
    width: baseW,
    height: baseH,
  };
}

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|$)/i;

export function isVideo(url: string | null | undefined): boolean {
  return !!url && VIDEO_EXT.test(url);
}

// Deterministic Picsum seed derived from a string — same input → same image.
function seedFrom(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return `leer-${Math.abs(h)}`;
}

function placeholder(seed: string, variant: MediaVariant): string {
  const w = VARIANT_WIDTH[variant];
  const h = variant === "avatar" ? w : Math.round(w * 0.66);
  return `https://picsum.photos/seed/${seedFrom(seed)}/${w}/${h}`;
}

// Rewrite a source URL to serve at the right dimensions. Recognises the two
// hosts we hotlink from and leaves any other URL untouched.
function withVariant(url: string, variant: MediaVariant): string {
  const w = VARIANT_WIDTH[variant];
  const h = variant === "avatar" ? w : Math.round(w * 0.66);
  try {
    const u = new URL(url);
    if (u.hostname === "images.unsplash.com") {
      u.searchParams.set("w", String(w));
      u.searchParams.set("q", "80");
      u.searchParams.set("auto", "format");
      u.searchParams.set("fit", "crop");
      return u.toString();
    }
    if (u.hostname === "picsum.photos") {
      // /seed/<name>/<w>/<h> or /<w>/<h>
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "seed" && parts.length >= 2) {
        u.pathname = `/seed/${parts[1]}/${w}/${h}`;
      } else {
        u.pathname = `/${w}/${h}`;
      }
      return u.toString();
    }
  } catch {
    // fall through — return unchanged
  }
  return url;
}

/**
 * Resolve a demo asset URL for a specific slot.
 * - If `url` is empty/nullish, returns a deterministic placeholder keyed by `seed`.
 * - If `url` is a video, returns it unchanged (variants only apply to images).
 * - Otherwise rewrites known image hosts to serve the right dimensions.
 */
export function resolveMedia(
  url: string | null | undefined,
  variant: MediaVariant,
  seed: string,
): string {
  if (!url) return placeholder(seed, variant);
  if (isVideo(url)) return url;
  return withVariant(url, variant);
}

/**
 * Derive a poster/thumbnail image for a video URL. Falls back to a
 * deterministic placeholder when no explicit poster is provided.
 */
export function resolvePoster(
  poster: string | null | undefined,
  seed: string,
  variant: MediaVariant = "thumb",
): string {
  return resolveMedia(poster, variant, `${seed}-poster`);
}

/**
 * Curated video library — short, hotlink-friendly Pexels stock loops.
 * Kept here so the seeder and any preview components share the same list.
 */
export const DEMO_VIDEO = {
  swim: "https://videos.pexels.com/video-files/4761426/4761426-uhd_2560_1440_25fps.mp4",
  run: "https://videos.pexels.com/video-files/4761711/4761711-uhd_2560_1440_25fps.mp4",
  lift: "https://videos.pexels.com/video-files/4720625/4720625-uhd_2560_1440_25fps.mp4",
  bike: "https://videos.pexels.com/video-files/5319754/5319754-uhd_2560_1440_25fps.mp4",
  yoga: "https://videos.pexels.com/video-files/4056525/4056525-uhd_2560_1440_25fps.mp4",
  box: "https://videos.pexels.com/video-files/4761789/4761789-uhd_2560_1440_25fps.mp4",
  climb: "https://videos.pexels.com/video-files/2795746/2795746-uhd_2560_1440_25fps.mp4",
  surf: "https://videos.pexels.com/video-files/1093662/1093662-uhd_2560_1440_25fps.mp4",
} as const;