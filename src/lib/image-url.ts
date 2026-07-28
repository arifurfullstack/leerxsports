// Utilities for requesting responsive, correctly-sized images from
// Supabase Storage / Lovable CDN URLs. Falls back to the original URL
// for hosts that don't support transforms.

export function isTransformable(url: string): boolean {
  if (!url) return false;
  if (url.includes("/object/sign/") || url.includes("token=")) {
    return false;
  }
  return (
    url.includes("/storage/v1/") ||
    url.includes("supabase.co") ||
    url.includes("supabase.in") ||
    url.includes("lovable.app")
  );
}

export function sizedImageUrl(
  url: string,
  width: number,
  opts: { quality?: number; height?: number; resize?: "cover" | "contain" } = {},
): string {
  if (!url || !isTransformable(url)) return url;
  try {
    const u = new URL(url, "http://x");
    u.searchParams.set("width", String(Math.round(width)));
    if (opts.height) u.searchParams.set("height", String(Math.round(opts.height)));
    if (opts.resize) u.searchParams.set("resize", opts.resize);
    u.searchParams.set("quality", String(opts.quality ?? 75));
    return url.startsWith("http") ? u.toString() : u.pathname + u.search;
  } catch {
    return url;
  }
}

// Build a srcSet across common breakpoints.
export function buildSrcSet(
  url: string,
  widths: number[] = [320, 640, 960, 1280, 1920],
  opts: { quality?: number } = {},
): string | undefined {
  if (!url || !isTransformable(url)) return undefined;
  return widths
    .map((w) => `${sizedImageUrl(url, w, opts)} ${w}w`)
    .join(", ");
}