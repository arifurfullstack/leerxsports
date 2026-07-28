import { useEffect, useRef, useState } from "react";
import { buildSrcSet, isTransformable, sizedImageUrl } from "@/lib/image-url";

type Fit = "cover" | "contain";

export function SmartImage({
  src,
  alt = "",
  widths,
  sizes,
  targetWidth,
  fit = "cover",
  eager = false,
  quality = 78,
  className = "",
  imgClassName = "",
  aspect,
  rounded = false,
  rootMargin = "200px",
}: {
  src: string;
  alt?: string;
  widths?: number[];
  sizes: string;
  targetWidth: number;
  fit?: Fit;
  eager?: boolean;
  quality?: number;
  className?: string;
  imgClassName?: string;
  /** e.g. "16/9", "1/1". If omitted, wrapper fills parent (use with h-* on parent). */
  aspect?: string;
  rounded?: boolean;
  /** IntersectionObserver rootMargin used to pre-warm images before scroll-in. */
  rootMargin?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(eager);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Observe wrapper visibility (skipped when eager).
  useEffect(() => {
    if (eager || visible) return;
    const el = wrapRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin, threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eager, visible, rootMargin]);

  // If the browser reads from cache, `onLoad` may fire before hydration.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  }, [src, visible]);

  // Reset loaded state when src changes so skeleton reappears.
  useEffect(() => {
    setLoaded(false);
  }, [src]);

  const placeholder = isTransformable(src)
    ? sizedImageUrl(src, 24, { quality: 30 })
    : null;

  const fitClass = fit === "cover" ? "object-cover" : "object-contain";
  const roundedClass = rounded ? "rounded-md" : "";
  const aspectStyle = aspect ? { aspectRatio: aspect } : undefined;

  return (
    <div
      ref={wrapRef}
      className={`relative overflow-hidden bg-muted ${roundedClass} ${className}`}
      style={aspectStyle}
      aria-busy={!loaded}
    >
      {/* Skeleton pulse */}
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-muted/70 to-muted" />
      )}
      {/* Blur-up placeholder (tiny transformed image) */}
      {!loaded && placeholder && (
        <img
          src={placeholder}
          alt=""
          aria-hidden="true"
          draggable={false}
          className={`absolute inset-0 h-full w-full scale-110 ${fitClass} blur-xl`}
        />
      )}
      {/* Main image — only mounted with real src once wrapper is near viewport */}
      {visible && (
        <img
          ref={imgRef}
          src={sizedImageUrl(src, targetWidth, { quality })}
          srcSet={buildSrcSet(src, widths, { quality })}
          sizes={sizes}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`relative h-full w-full ${fitClass} transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          } ${imgClassName}`}
        />
      )}
    </div>
  );
}