import { useEffect, useRef } from "react";

/**
 * Lightweight client analytics.
 *
 * - Pushes events to `window.dataLayer` (GTM-compatible) so any downstream
 *   provider (GA4, PostHog via GTM, Segment) can consume without code changes.
 * - Also mirrors to `console.debug` in dev and dispatches a `leer:analytics`
 *   CustomEvent so tests and the perf HUD can listen in.
 * - No-ops safely on the server.
 */

type Props = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

export function track(event: string, props: Props = {}) {
  if (typeof window === "undefined") return;
  const payload = {
    event,
    ts: Date.now(),
    path: window.location.pathname,
    viewport: isMobileViewport() ? "mobile" : "desktop",
    ...props,
  };
  (window.dataLayer = window.dataLayer || []).push(payload);
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", event, payload);
  }
  window.dispatchEvent(new CustomEvent("leer:analytics", { detail: payload }));
}

/**
 * Fire a `section_impression` event the first time `ref` becomes ≥50% visible.
 * Uses IntersectionObserver so it's cheap on mobile.
 */
export function useImpression<T extends Element>(
  ref: React.RefObject<T | null>,
  section: string,
  extra: Props = {},
) {
  const seen = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.5 && !seen.current) {
            seen.current = true;
            track("section_impression", { section, ...extra });
            io.disconnect();
          }
        }
      },
      { threshold: [0.5] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, section, extra]);
}

/**
 * Emit `scroll_depth` events once per milestone (25/50/75/100) on the current
 * page. Milestones fire at most once per page load.
 */
export function useScrollDepth(page: string) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fired = new Set<number>();
    const milestones = [25, 50, 75, 100];
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const doc = document.documentElement;
        const scrolled = window.scrollY + window.innerHeight;
        const height = Math.max(doc.scrollHeight, 1);
        const pct = Math.min(100, Math.round((scrolled / height) * 100));
        for (const m of milestones) {
          if (pct >= m && !fired.has(m)) {
            fired.add(m);
            track("scroll_depth", { page, depth: m });
          }
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [page]);
}