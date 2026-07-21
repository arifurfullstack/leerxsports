import { forwardRef, type ImgHTMLAttributes } from "react";
import { buildResponsive, type MediaVariant } from "@/lib/demo-media";

export interface ResponsiveImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "sizes"> {
  /** Source URL. May be null/undefined; a deterministic placeholder is used. */
  src: string | null | undefined;
  /** Slot the image is rendered in — controls candidate widths + default `sizes`. */
  variant: MediaVariant;
  /** Seed used for placeholder fallback (usually an id or slug). */
  seed: string;
  /** Optional override for the responsive `sizes` attribute. */
  sizes?: string;
  alt: string;
}

/**
 * `<img>` wrapper that emits `srcset` + `sizes` for known demo image hosts so
 * mobile devices download smaller assets. Falls back to a single URL when the
 * source isn't a supported CDN.
 */
export const ResponsiveImage = forwardRef<HTMLImageElement, ResponsiveImageProps>(
  function ResponsiveImage({ src, variant, seed, sizes, alt, loading, decoding, ...rest }, ref) {
    const media = buildResponsive(src, variant, seed, sizes);
    return (
      <img
        ref={ref}
        src={media.src}
        srcSet={media.srcSet}
        sizes={media.sizes}
        width={media.width}
        height={media.height}
        alt={alt}
        loading={loading ?? "lazy"}
        decoding={decoding ?? "async"}
        {...rest}
      />
    );
  },
);