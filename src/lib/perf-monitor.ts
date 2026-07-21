/**
 * Lightweight in-page performance instrumentation.
 *
 * - Core Web Vitals via `web-vitals` (LCP, CLS, INP, FCP, TTFB).
 * - Live FPS via a rAF sampler that averages frames-per-second across a
 *   ~500ms window — useful to confirm scroll smoothness on mobile.
 * - Long-task counter via `PerformanceObserver` for `longtask` entries.
 *
 * Everything is client-only, cheap, and no-ops during SSR.
 */

import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";

export type VitalName = "CLS" | "FCP" | "INP" | "LCP" | "TTFB";

export interface PerfSnapshot {
  vitals: Partial<Record<VitalName, { value: number; rating: Metric["rating"] }>>;
  fps: number;
  minFps: number;
  longTasks: number;
}

type Listener = (snap: PerfSnapshot) => void;

const snapshot: PerfSnapshot = {
  vitals: {},
  fps: 0,
  minFps: 0,
  longTasks: 0,
};

const listeners = new Set<Listener>();
let started = false;
let rafId = 0;
let longTaskObserver: PerformanceObserver | null = null;

function emit() {
  for (const l of listeners) l(snapshot);
}

function trackVital(metric: Metric) {
  snapshot.vitals[metric.name as VitalName] = {
    value: metric.value,
    rating: metric.rating,
  };
  emit();
}

function startFps() {
  let frames = 0;
  let windowStart = performance.now();
  let firstSample = true;

  const tick = (now: number) => {
    frames += 1;
    const elapsed = now - windowStart;
    if (elapsed >= 500) {
      const fps = Math.round((frames * 1000) / elapsed);
      snapshot.fps = fps;
      // Skip the very first sample for `minFps` — startup jank isn't
      // representative of steady-state scroll performance.
      if (firstSample) {
        snapshot.minFps = fps;
        firstSample = false;
      } else if (fps < snapshot.minFps || snapshot.minFps === 0) {
        snapshot.minFps = fps;
      }
      frames = 0;
      windowStart = now;
      emit();
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function startLongTasks() {
  if (typeof PerformanceObserver === "undefined") return;
  try {
    longTaskObserver = new PerformanceObserver((list) => {
      snapshot.longTasks += list.getEntries().length;
      emit();
    });
    longTaskObserver.observe({ type: "longtask", buffered: true });
  } catch {
    // `longtask` not supported (Safari); ignore.
  }
}

/**
 * Start collecting metrics. Idempotent — safe to call from multiple mounts.
 */
export function startPerfMonitor() {
  if (started || typeof window === "undefined") return;
  started = true;
  onCLS(trackVital);
  onLCP(trackVital);
  onINP(trackVital);
  onFCP(trackVital);
  onTTFB(trackVital);
  startFps();
  startLongTasks();
}

export function stopPerfMonitor() {
  if (!started) return;
  started = false;
  cancelAnimationFrame(rafId);
  longTaskObserver?.disconnect();
  longTaskObserver = null;
}

export function subscribePerf(fn: Listener): () => void {
  listeners.add(fn);
  fn(snapshot);
  return () => {
    listeners.delete(fn);
  };
}

export function getPerfSnapshot(): PerfSnapshot {
  return snapshot;
}

/**
 * True when the perf HUD should be visible. Enabled by either:
 * - `?perf=1` query parameter, or
 * - `localStorage.leer_perf === "1"`.
 */
export function isPerfEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("perf") === "1") {
      window.localStorage.setItem("leer_perf", "1");
      return true;
    }
    if (params.get("perf") === "0") {
      window.localStorage.removeItem("leer_perf");
      return false;
    }
    return window.localStorage.getItem("leer_perf") === "1";
  } catch {
    return false;
  }
}