import * as React from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TabPanelState = "ready" | "loading" | "error";

export function TabPanel({
  state = "ready",
  skeleton,
  error,
  onRetry,
  children,
  className,
  tabKey,
}: {
  state?: TabPanelState;
  skeleton?: React.ReactNode;
  error?: unknown;
  onRetry?: () => void;
  children?: React.ReactNode;
  className?: string;
  /**
   * Optional key used to re-trigger the fade animation when the active tab
   * changes. Set to the current tab value.
   */
  tabKey?: string;
}) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Something went wrong loading this section.";

  return (
    <div
      key={tabKey}
      className={cn(
        "animate-in fade-in-0 duration-200 ease-out motion-reduce:animate-none",
        className,
      )}
    >
      {state === "loading" && (skeleton ?? <TabDefaultSkeleton />)}
      {state === "error" && (
        <div
          role="alert"
          aria-live="polite"
          className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center"
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-sm uppercase tracking-widest">
              Couldn't load this tab
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry} className="gap-2">
              <RefreshCcw className="h-4 w-4" /> Retry
            </Button>
          )}
        </div>
      )}
      {state === "ready" && children}
    </div>
  );
}

export function TabDefaultSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          <div className="aspect-[4/5] w-full animate-pulse bg-muted" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TabGridSkeleton({
  count = 6,
  columns = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  aspect = "aspect-[4/5]",
}: {
  count?: number;
  columns?: string;
  aspect?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("grid gap-2 sm:gap-3", columns)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-full animate-pulse rounded-xl bg-muted",
            aspect,
          )}
        />
      ))}
    </div>
  );
}