import { useEffect, useMemo, useState } from "react";

import { VerifiedBadge } from "@/components/verified-badge";

type Size = "sm" | "md" | "lg" | "xl" | "full";

const SIZE_MAP: Record<Size, { cls: string; px: number }> = {
  sm: { cls: "h-7 w-7 text-[10px]", px: 28 },
  md: { cls: "h-9 w-9 text-xs", px: 36 },
  lg: { cls: "h-12 w-12 text-sm", px: 48 },
  xl: { cls: "h-20 w-20 text-lg", px: 80 },
  full: { cls: "h-full w-full text-base", px: 80 },
};

// In-memory cache: URLs we've already resolved (loaded or errored) so remounts
// don't flash a skeleton for images the browser has cached this session.
const RESOLVED: Map<string, "loaded" | "error"> = new Map();

// Supabase Storage & CDN URLs support ?width= and ?quality= transforms. Use
// them to request an avatar-sized thumbnail instead of the full upload.
function isTransformable(url: string): boolean {
  return (
    url.includes("/storage/v1/") ||
    url.includes("supabase.co") ||
    url.includes("supabase.in") ||
    url.includes("lovable.app") ||
    url.includes("googleusercontent.com")
  );
}

function sizedUrl(url: string, targetPx: number): string {
  if (!isTransformable(url)) return url;
  // googleusercontent supports =sN
  if (url.includes("googleusercontent.com")) {
    return url.replace(/=s\d+(-c)?$/, "") + `=s${targetPx}-c`;
  }
  try {
    const u = new URL(url, "http://x");
    u.searchParams.set("width", String(targetPx));
    u.searchParams.set("height", String(targetPx));
    u.searchParams.set("resize", "cover");
    u.searchParams.set("quality", "75");
    // Preserve original if it was a relative URL
    return url.startsWith("http") ? u.toString() : u.pathname + u.search;
  } catch {
    return url;
  }
}

export interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  size?: Size;
  isTrainer?: boolean;
  verified?: boolean;
  className?: string;
  /** Hint that this avatar is above-the-fold; disables lazy loading. */
  eager?: boolean;
}

function initialsFrom(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const chars = parts.map((p) => p.charAt(0)).join("");
  return (chars || name.charAt(0) || "?").toUpperCase();
}

// Deterministic hue for fallback background so users get a stable color.
function hueFrom(name?: string | null): number {
  if (!name) return 0;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function UserAvatar({
  src,
  name,
  size = "md",
  isTrainer,
  verified,
  className = "",
  eager = false,
}: UserAvatarProps) {
  const { cls, px } = SIZE_MAP[size];
  const resolved = useMemo(() => {
    if (!src) return null;
    return {
      src1x: sizedUrl(src, px),
      src2x: sizedUrl(src, px * 2),
    };
  }, [src, px]);

  const cacheKey = resolved?.src1x;
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">(
    () => {
      if (!cacheKey) return "idle";
      return RESOLVED.get(cacheKey) ?? "loading";
    },
  );

  useEffect(() => {
    if (!cacheKey) {
      setStatus("idle");
      return;
    }
    setStatus(RESOLVED.get(cacheKey) ?? "loading");
  }, [cacheKey]);

  const hue = hueFrom(name);
  const showImage = !!resolved && status !== "error";
  const showFallback = !resolved || status === "error";
  const showSkeleton = !!resolved && status === "loading";

  return (
    <div className={`relative shrink-0 ${className}`}>
      <div
        className={`relative flex items-center justify-center overflow-hidden rounded-full border font-semibold uppercase ${
          cls
        } ${
          isTrainer
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-muted text-muted-foreground"
        }`}
        aria-label={name ?? "user avatar"}
      >
      {showFallback && (
        <span
          className="flex h-full w-full items-center justify-center"
          style={
            !isTrainer && name
              ? {
                  background: `hsl(${hue} 60% 22%)`,
                  color: `hsl(${hue} 90% 82%)`,
                }
              : undefined
          }
          aria-hidden="true"
        >
          {initialsFrom(name)}
        </span>
      )}
      {showImage && resolved && (
        <img
          src={resolved.src1x}
          srcSet={`${resolved.src1x} 1x, ${resolved.src2x} 2x`}
          width={px}
          height={px}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => {
            if (cacheKey) RESOLVED.set(cacheKey, "loaded");
            setStatus("loaded");
          }}
          onError={() => {
            if (cacheKey) RESOLVED.set(cacheKey, "error");
            setStatus("error");
          }}
          className={`absolute inset-0 h-full w-full object-cover object-center [aspect-ratio:1/1] transition-opacity duration-200 ${
            status === "loaded" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      {showSkeleton && (
        <span
          className="absolute inset-0 animate-pulse bg-muted/70"
          aria-hidden="true"
        />
      )}
      </div>
      {verified && (
        <VerifiedBadge
          size={size === "sm" ? "sm" : size === "md" ? "sm" : "md"}
          className="absolute -bottom-0.5 -right-0.5"
        />
      )}
    </div>
  );
}