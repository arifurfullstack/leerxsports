import { useEffect, useRef, useState } from "react";

/**
 * Detects low-power/constrained devices so heavy hero effects can be dialed down.
 * Signals: prefers-reduced-motion, Save-Data, slow connection, low deviceMemory, low CPU cores.
 */
export function useLowPowerMode(): boolean {
  const [low, setLow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean; effectiveType?: string };
    };
    const compute = () => {
      const conn = nav.connection;
      const slowNet =
        !!conn?.saveData ||
        (conn?.effectiveType ? /(^|-)(2g|slow-2g)$/.test(conn.effectiveType) : false);
      const lowMem = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
      const lowCpu =
        typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4;
      setLow(mql.matches || slowNet || lowMem || lowCpu);
    };
    compute();
    mql.addEventListener?.("change", compute);
    const conn = nav.connection as (EventTarget & { addEventListener?: EventTarget["addEventListener"] }) | undefined;
    conn?.addEventListener?.("change", compute);
    return () => {
      mql.removeEventListener?.("change", compute);
      conn?.removeEventListener?.("change", compute);
    };
  }, []);
  return low;
}

/**
 * Returns [ref, inView] — inView flips true when the element intersects the viewport.
 * Once out of view, animations can be paused to save CPU/GPU.
 */
export function useInView<T extends Element>(rootMargin = "0px"): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return [ref, inView];
}

/**
 * One-shot variant: flips to true the first time the element intersects the
 * viewport, then stays true and disconnects. Ideal for mount-on-visible
 * (lazy-render) patterns where we don't want the content to unmount when it
 * scrolls back out of view.
 */
export function useHasBeenInView<T extends Element>(
  rootMargin = "200px",
): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, seen]);
  return [ref, seen];
}