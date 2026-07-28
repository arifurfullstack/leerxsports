import React, { useState } from "react";
import pkg from "react-lazy-load-image-component";
import "react-lazy-load-image-component/src/effects/blur.css";

const LazyLoadImage = (pkg as any)?.LazyLoadImage || pkg;
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageIcon } from "lucide-react";

export interface LazyImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string | undefined | null;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  fallbackSrc?: string;
  aspectRatio?: string;
  objectFit?: "cover" | "contain" | "fill" | "none";
  effect?: "blur" | "opacity";
  showSkeleton?: boolean;
}

const DEFAULT_FALLBACK = "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400&q=80";

export function LazyImage({
  src,
  alt,
  className,
  wrapperClassName,
  fallbackSrc = DEFAULT_FALLBACK,
  aspectRatio,
  objectFit = "cover",
  effect = "blur",
  showSkeleton = true,
  ...props
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const imgSrc = error || !src ? fallbackSrc : src;

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted/40",
        aspectRatio,
        wrapperClassName
      )}
    >
      {/* Skeleton Shimmer while loading */}
      {!loaded && showSkeleton && (
        <Skeleton className="absolute inset-0 z-10 h-full w-full animate-pulse bg-muted" />
      )}

      {/* Fallback Icon if image fails completely */}
      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-muted p-2 text-center text-muted-foreground">
          <ImageIcon className="h-6 w-6 mb-1 opacity-50" />
        </div>
      )}

      <LazyLoadImage
        src={imgSrc}
        alt={alt}
        effect={effect}
        wrapperClassName={cn("h-full w-full", wrapperClassName)}
        className={cn(
          "h-full w-full transition-all duration-300",
          objectFit === "cover" && "object-cover",
          objectFit === "contain" && "object-contain",
          objectFit === "fill" && "object-fill",
          loaded ? "opacity-100" : "opacity-0",
          className
        )}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setError(true);
          setLoaded(true);
        }}
        {...(props as any)}
      />
    </div>
  );
}
