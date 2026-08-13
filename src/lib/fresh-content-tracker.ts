import { useState, useEffect } from "react";

const SEEN_POSTS_KEY = "leer_seen_posts_v1";
const FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSeenPostIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SEEN_POSTS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function isPostFresh(postId: string, createdAt: string): boolean {
  if (!createdAt) return false;
  const createdTime = new Date(createdAt).getTime();
  if (isNaN(createdTime)) return false;
  const isWithinWindow = Date.now() - createdTime < FRESHNESS_WINDOW_MS;
  if (!isWithinWindow) return false;

  const seen = getSeenPostIds();
  return !seen.has(postId);
}

export function markPostAsSeen(postId: string): void {
  if (typeof window === "undefined" || !postId) return;
  try {
    const seen = getSeenPostIds();
    if (!seen.has(postId)) {
      seen.add(postId);
      const arr = Array.from(seen).slice(-500);
      localStorage.setItem(SEEN_POSTS_KEY, JSON.stringify(arr));
      window.dispatchEvent(new CustomEvent("leer:seen_posts_updated", { detail: { postId } }));
    }
  } catch {
    /* ignore storage errors */
  }
}

export function useFreshContentTracker() {
  const [seenSet, setSeenSet] = useState<Set<string>>(() => getSeenPostIds());

  useEffect(() => {
    const handleUpdate = () => setSeenSet(getSeenPostIds());
    window.addEventListener("leer:seen_posts_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("leer:seen_posts_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const checkFresh = (postId: string, createdAt: string): boolean => {
    if (!createdAt) return false;
    const createdTime = new Date(createdAt).getTime();
    if (isNaN(createdTime)) return false;
    const isWithinWindow = Date.now() - createdTime < FRESHNESS_WINDOW_MS;
    return isWithinWindow && !seenSet.has(postId);
  };

  return { isFresh: checkFresh, markSeen: markPostAsSeen };
}
