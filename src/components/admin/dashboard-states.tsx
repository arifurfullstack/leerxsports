import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Reusable loading / empty / error primitives for admin dashboard cards
 * and charts. Keep visual language consistent across every panel.
 */

export function CardShell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
      {children}
    </div>
  );
}

export function HeroStatSkeleton() {
  return (
    <CardShell className="relative overflow-hidden">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="mt-4 h-8 w-24" />
      <div className="mt-2 flex items-center gap-2">
        <Skeleton className="h-4 w-10 rounded-full" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="mt-4 h-10 w-full" />
    </CardShell>
  );
}

export function ChartSkeleton({
  height = "h-72",
  title = true,
}: {
  height?: string;
  title?: boolean;
}) {
  return (
    <CardShell>
      {title ? (
        <div className="mb-4 flex items-baseline justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ) : null}
      <div className={cn("w-full", height)}>
        <div className="flex h-full items-end gap-1.5">
          {Array.from({ length: 24 }).map((_, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t-md"
              style={{ height: `${20 + ((i * 37) % 70)}%` }}
            />
          ))}
        </div>
      </div>
    </CardShell>
  );
}

export function DonutSkeleton() {
  return (
    <CardShell>
      <div className="mb-2 flex items-baseline justify-between">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="grid h-56 place-items-center">
        <div className="relative h-40 w-40">
          <Skeleton className="absolute inset-0 rounded-full" />
          <div className="absolute inset-6 rounded-full bg-card" />
        </div>
      </div>
      <ul className="mt-2 space-y-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-10" />
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

export function ListCardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <CardShell>
      <div className="mb-3 flex items-baseline justify-between">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-10" />
      </div>
      <ul className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-3 w-10" />
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

export function SecondaryStripSkeleton() {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5"
        >
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-10" />
          </div>
          <Skeleton className="h-4 w-4" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <main className="min-h-dvh bg-background py-8" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-3">
            <Skeleton className="h-4 w-32 rounded-full" />
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-3 w-96" />
          </div>
          <Skeleton className="h-9 w-64 rounded-lg" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <HeroStatSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ChartSkeleton />
          </div>
          <DonutSkeleton />
        </div>
        <SecondaryStripSkeleton />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ChartSkeleton height="h-56" />
          </div>
          <ListCardSkeleton />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <ListCardSkeleton rows={4} />
          <ListCardSkeleton rows={4} />
          <ListCardSkeleton rows={4} />
        </div>
      </div>
      <span className="sr-only">Loading dashboard…</span>
    </main>
  );
}

export function ErrorBanner({
  title = "Couldn't load this section",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-destructive">{title}</p>
        {message ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{message}</p>
        ) : null}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-destructive/40 bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-destructive hover:bg-destructive/10"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  desc,
  action,
  className,
  height = "h-56",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc?: string;
  action?: React.ReactNode;
  className?: string;
  height?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 px-4 text-center",
        height,
        className,
      )}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-muted/40 text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      {desc ? <p className="mt-1 max-w-xs text-xs text-muted-foreground">{desc}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/**
 * Per-card error boundary that catches render/data errors thrown by a
 * Suspense child (e.g. a query throwing on refetch) so one broken card
 * doesn't blank the whole dashboard.
 */
export class CardErrorBoundary extends React.Component<
  { children: React.ReactNode; title?: string; onRetry?: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  reset = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };
  render() {
    if (this.state.error) {
      return (
        <ErrorBanner
          title={this.props.title ?? "Couldn't load this card"}
          message={this.state.error.message}
          onRetry={this.reset}
        />
      );
    }
    return this.props.children;
  }
}