import { useEffect, useState } from "react";
import {
  isPerfEnabled,
  startPerfMonitor,
  subscribePerf,
  type PerfSnapshot,
  type VitalName,
} from "@/lib/perf-monitor";

// Web-vitals thresholds map to the standard `rating` values, but we colorize
// FPS ourselves — anything below 50 on mobile is worth a look.
function fpsColor(fps: number): string {
  if (fps === 0) return "text-muted-foreground";
  if (fps >= 55) return "text-emerald-400";
  if (fps >= 45) return "text-amber-400";
  return "text-red-400";
}

function ratingColor(rating: string | undefined): string {
  switch (rating) {
    case "good":
      return "text-emerald-400";
    case "needs-improvement":
      return "text-amber-400";
    case "poor":
      return "text-red-400";
    default:
      return "text-muted-foreground";
  }
}

function formatVital(name: VitalName, value: number): string {
  if (name === "CLS") return value.toFixed(3);
  return `${Math.round(value)}ms`;
}

const VITAL_ORDER: VitalName[] = ["LCP", "INP", "CLS", "FCP", "TTFB"];

/**
 * Floating perf HUD. Only rendered when `?perf=1` (or persisted flag) is set.
 * Shows Core Web Vitals plus a live FPS sampler so mobile scroll smoothness
 * can be verified against the recent tile / media optimizations.
 */
export function PerfOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [snap, setSnap] = useState<PerfSnapshot | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!isPerfEnabled()) return;
    setEnabled(true);
    startPerfMonitor();
    const unsub = subscribePerf(setSnap);
    return unsub;
  }, []);

  if (!enabled || !snap) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-3 right-3 z-[200] select-none rounded-lg border border-border/70 bg-background/85 p-2 font-mono text-[11px] leading-tight text-foreground shadow-xl backdrop-blur"
      style={{ minWidth: collapsed ? 0 : 168 }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">
          Perf
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="rounded px-1 text-muted-foreground hover:text-foreground"
          aria-label={collapsed ? "Expand perf overlay" : "Collapse perf overlay"}
        >
          {collapsed ? "+" : "–"}
        </button>
      </div>
      {!collapsed && (
        <div className="mt-1.5 space-y-0.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">FPS</span>
            <span className={fpsColor(snap.fps)}>
              {snap.fps}
              <span className="ml-1 text-[10px] text-muted-foreground">
                min {snap.minFps}
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Long tasks</span>
            <span className={snap.longTasks > 0 ? "text-amber-400" : "text-emerald-400"}>
              {snap.longTasks}
            </span>
          </div>
          <div className="my-1 h-px bg-border/60" />
          {VITAL_ORDER.map((name) => {
            const v = snap.vitals[name];
            return (
              <div key={name} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{name}</span>
                <span className={ratingColor(v?.rating)}>
                  {v ? formatVital(name, v.value) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}