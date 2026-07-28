/**
 * Editorial UI primitives — the shared Gymshark/OnlyFans-style typography
 * and badge kit for LEER. Use these across every dashboard section (and
 * anywhere else that needs the house look) so headlines, stat numbers,
 * eyebrows, pills, and watermarks stay perfectly consistent.
 *
 * All tokens flow through the semantic design system in `src/styles.css`.
 * Do NOT hardcode colors here — use `text-primary`, `text-muted-foreground`,
 * `border-primary/…`, etc.
 */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Display headline — the giant Anton uppercase hero title.          */
/* ------------------------------------------------------------------ */

const displayVariants = cva(
  "font-display uppercase leading-[0.95] tracking-tight text-foreground",
  {
    variants: {
      size: {
        sm: "text-xl sm:text-2xl md:text-3xl",
        md: "text-2xl sm:text-3xl md:text-4xl",
        lg: "text-2xl sm:text-4xl md:text-5xl",
        xl: "text-2xl sm:text-5xl md:text-6xl",
        "2xl": "text-3xl sm:text-6xl md:text-7xl",
      },
      tone: {
        default: "",
        primary: "text-primary",
        muted: "text-muted-foreground",
      },
      truncate: {
        true: "truncate",
        false: "",
      },
    },
    defaultVariants: { size: "xl", tone: "default", truncate: false },
  },
);

type DisplayProps = React.HTMLAttributes<HTMLHeadingElement> &
  VariantProps<typeof displayVariants> & {
    as?: "h1" | "h2" | "h3" | "h4" | "p";
    /** Append the signature red dot. Defaults to true. */
    dot?: boolean;
    asChild?: boolean;
  };

export const Display = React.forwardRef<HTMLHeadingElement, DisplayProps>(
  ({ as: Tag = "h1", size, tone, truncate, dot = true, asChild, className, children, ...props }, ref) => {
    const Comp: React.ElementType = asChild ? Slot : Tag;
    return (
      <Comp ref={ref} className={cn(displayVariants({ size, tone, truncate }), className)} {...props}>
        {children}
        {dot && <span className="text-primary">.</span>}
      </Comp>
    );
  },
);
Display.displayName = "Display";

/* ------------------------------------------------------------------ */
/*  Section heading — the smaller tracked uppercase label above lists */
/* ------------------------------------------------------------------ */

const sectionHeadingVariants = cva(
  "font-display uppercase tracking-widest text-foreground",
  {
    variants: {
      size: {
        sm: "text-sm",
        md: "text-base sm:text-lg",
        lg: "text-lg sm:text-xl",
      },
    },
    defaultVariants: { size: "md" },
  },
);

type SectionHeadingProps = React.HTMLAttributes<HTMLHeadingElement> &
  VariantProps<typeof sectionHeadingVariants> & {
    as?: "h2" | "h3" | "h4";
  };

export const SectionHeading = React.forwardRef<HTMLHeadingElement, SectionHeadingProps>(
  ({ as: Tag = "h2", size, className, ...props }, ref) => (
    <Tag ref={ref} className={cn(sectionHeadingVariants({ size }), className)} {...props} />
  ),
);
SectionHeading.displayName = "SectionHeading";

/* ------------------------------------------------------------------ */
/*  Eyebrow — mono uppercase tracked micro-label above titles         */
/* ------------------------------------------------------------------ */

const eyebrowVariants = cva(
  "inline-flex items-center gap-1.5 font-mono uppercase",
  {
    variants: {
      size: {
        xs: "text-[9px] tracking-[0.25em] sm:text-[10px] sm:tracking-[0.3em]",
        sm: "text-[10px] tracking-[0.3em]",
        md: "text-xs tracking-[0.35em]",
      },
      tone: {
        muted: "text-muted-foreground",
        default: "text-foreground/80",
        primary: "text-primary",
      },
    },
    defaultVariants: { size: "sm", tone: "muted" },
  },
);

type EyebrowProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof eyebrowVariants>;

export const Eyebrow = React.forwardRef<HTMLSpanElement, EyebrowProps>(
  ({ size, tone, className, ...props }, ref) => (
    <span ref={ref} className={cn(eyebrowVariants({ size, tone }), className)} {...props} />
  ),
);
Eyebrow.displayName = "Eyebrow";

/* ------------------------------------------------------------------ */
/*  StatNumber — giant Anton display number for stat tiles / KPIs     */
/* ------------------------------------------------------------------ */

const statNumberVariants = cva(
  "font-display uppercase leading-none tracking-tight",
  {
    variants: {
      size: {
        sm: "text-xl sm:text-2xl",
        md: "text-2xl sm:text-3xl",
        lg: "text-2xl sm:text-4xl",
        xl: "text-3xl sm:text-5xl",
      },
      tone: {
        default: "text-foreground",
        primary: "text-primary",
        muted: "text-muted-foreground",
      },
      truncate: {
        true: "truncate",
        false: "",
      },
    },
    defaultVariants: { size: "lg", tone: "default", truncate: true },
  },
);

type StatNumberProps = React.HTMLAttributes<HTMLParagraphElement> &
  VariantProps<typeof statNumberVariants>;

export const StatNumber = React.forwardRef<HTMLParagraphElement, StatNumberProps>(
  ({ size, tone, truncate, className, ...props }, ref) => (
    <p ref={ref} className={cn(statNumberVariants({ size, tone, truncate }), className)} {...props} />
  ),
);
StatNumber.displayName = "StatNumber";

/* ------------------------------------------------------------------ */
/*  Pill — the unified badge (roles, statuses, filters, meta tags)    */
/* ------------------------------------------------------------------ */

const pillVariants = cva(
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-display uppercase tracking-[0.3em]",
  {
    variants: {
      variant: {
        primary:
          "border-primary/40 bg-primary/10 text-primary shadow-[0_0_16px_-6px_hsl(var(--primary)/0.6)]",
        outline:
          "border-border/70 bg-background/60 text-muted-foreground",
        solid:
          "border-primary/60 bg-primary text-primary-foreground shadow-[0_0_20px_-4px_hsl(var(--primary)/0.7)]",
        success:
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
        warning:
          "border-amber-500/40 bg-amber-500/10 text-amber-400",
        destructive:
          "border-destructive/50 bg-destructive/10 text-destructive",
        ghost:
          "border-transparent bg-transparent text-muted-foreground",
      },
      size: {
        xs: "px-2 py-0.5 text-[9px]",
        sm: "px-2.5 py-1 text-[10px]",
        md: "px-3 py-1.5 text-[11px]",
      },
      pulse: {
        true: "",
        false: "",
      },
    },
    defaultVariants: { variant: "primary", size: "sm", pulse: false },
  },
);

type PillProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof pillVariants> & {
    /** Show a leading dot indicator (great for status: LIVE, ONLINE, etc.). */
    dot?: boolean;
  };

export const Pill = React.forwardRef<HTMLSpanElement, PillProps>(
  ({ variant, size, pulse, dot, className, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(pillVariants({ variant, size, pulse }), className)}
      {...props}
    >
      {dot && (
        <span
          aria-hidden
          className={cn(
            "h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]",
            pulse && "animate-pulse",
          )}
        />
      )}
      {children}
    </span>
  ),
);
Pill.displayName = "Pill";

/* ------------------------------------------------------------------ */
/*  Watermark — decorative giant background wordmark                  */
/* ------------------------------------------------------------------ */

type WatermarkProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  /** Corner/edge to anchor to. */
  position?: "br" | "bl" | "tr" | "tl";
  size?: "sm" | "md" | "lg" | "xl";
};

const watermarkPos: Record<NonNullable<WatermarkProps["position"]>, string> = {
  br: "-right-6 bottom-[-2.5rem]",
  bl: "-left-6 bottom-[-2.5rem]",
  tr: "-right-6 top-[-2.5rem]",
  tl: "-left-6 top-[-2.5rem]",
};

const watermarkSize: Record<NonNullable<WatermarkProps["size"]>, string> = {
  sm: "text-[5rem]",
  md: "text-[7rem]",
  lg: "text-[9rem]",
  xl: "text-[12rem]",
};

export function Watermark({
  position = "br",
  size = "lg",
  className,
  children,
  ...props
}: WatermarkProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute hidden select-none font-display uppercase leading-none tracking-tighter text-foreground/[0.04] sm:block",
        watermarkPos[position],
        watermarkSize[size],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Divider — hairline w/ optional gradient (matches hero edge line)  */
/* ------------------------------------------------------------------ */

export function EditorialDivider({
  className,
  glow = false,
}: {
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "h-px w-full",
        glow
          ? "bg-gradient-to-r from-transparent via-primary/60 to-transparent"
          : "bg-gradient-to-r from-transparent via-border to-transparent",
        className,
      )}
    />
  );
}