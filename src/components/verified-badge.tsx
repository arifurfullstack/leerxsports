import { Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE: Record<Size, { box: string; icon: string }> = {
  sm: { box: "h-3.5 w-3.5", icon: "h-2.5 w-2.5" },
  md: { box: "h-4 w-4", icon: "h-3 w-3" },
  lg: { box: "h-5 w-5", icon: "h-3.5 w-3.5" },
  xl: { box: "h-6 w-6", icon: "h-4 w-4" },
};

/**
 * Instagram-style verified checkmark. Rendered as an inline element so it
 * flows next to display names. Pair with a11y label describing why.
 */
export function VerifiedBadge({
  size = "md",
  className = "",
  title = "Verified account",
  verifiedAt,
  verifiedByName,
  showTooltip = true,
}: {
  size?: Size;
  className?: string;
  title?: string;
  verifiedAt?: string | null;
  verifiedByName?: string | null;
  showTooltip?: boolean;
}) {
  const s = SIZE[size];
  const badge = (
    <span
      role="img"
      aria-label={title}
      className={`inline-flex shrink-0 cursor-help items-center justify-center rounded-full bg-sky-500 text-white shadow-[0_0_0_2px_hsl(var(--background))] ${s.box} ${className}`}
    >
      <Check className={`${s.icon} stroke-[3]`} />
    </span>
  );

  if (!showTooltip) return badge;

  const when = verifiedAt
    ? new Date(verifiedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
          <p className="font-medium text-foreground">Verified account</p>
          <p className="mt-1 text-muted-foreground">
            LEER confirmed this account represents the real person or brand it
            claims to be. Verification is granted manually by our admin team.
          </p>
          {(when || verifiedByName) && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {when && <>Verified {when}</>}
              {when && verifiedByName && " · "}
              {verifiedByName && <>by {verifiedByName}</>}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}