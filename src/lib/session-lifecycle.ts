/**
 * Pure helpers for the "session expired mid-session" flow.
 *
 * Supabase's client auto-refreshes access tokens while the refresh token is
 * still valid. When the refresh itself fails (revoked/expired refresh token,
 * password change on another device, admin-forced logout), supabase-js emits
 * `SIGNED_OUT`. We use these helpers to:
 *
 *   1. distinguish user-initiated sign-outs from forced expiry, and
 *   2. decide when a forced expiry should bounce the user to `/auth`
 *      pre-populated with a `redirect` param that returns them to where
 *      they were.
 */

// Top-level paths that require an authenticated session. Kept in sync with
// the routes under `src/routes/_authenticated/`. A forced sign-out on any
// other path is silent — the router-managed auth gate will still redirect
// on the next protected navigation.
export const PROTECTED_PREFIXES = [
  "/admin",
  "/creator.dashboard",
  "/dashboard",
  "/library",
  "/messages",
  "/notifications",
  "/onboarding",
  "/profile",
  "/qa",
  "/settings",
  "/trainer.profile",
  "/trainer/profile",
] as const;

export function isProtectedPath(pathname: string): boolean {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return false;
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * A short-lived flag set by the sign-out handlers so the expiry watcher can
 * ignore the `SIGNED_OUT` event that immediately follows. We track it with a
 * timestamp instead of a boolean so a stale flag from an earlier interaction
 * can never suppress a real expiry event minutes later.
 */
let manualSignOutAt = 0;
const MANUAL_WINDOW_MS = 5_000;

export function markManualSignOut(now: number = Date.now()): void {
  manualSignOutAt = now;
}

export function wasManualSignOut(now: number = Date.now()): boolean {
  return manualSignOutAt !== 0 && now - manualSignOutAt < MANUAL_WINDOW_MS;
}

export function clearManualSignOut(): void {
  manualSignOutAt = 0;
}

export interface ExpiryRedirect {
  to: "/";
  replace: true;
}

/**
 * Build a `router.navigate(...)` payload that lands on landing page `/`.
 */
export function buildExpiryRedirect(_pathname?: string): ExpiryRedirect {
  return { to: "/", replace: true };
}

/**
 * True when a proactively-fetched session is about to expire and should be
 * refreshed before we attach its access token to an outbound request.
 *
 * `expiresAt` is the Supabase session's `expires_at` field (unix seconds).
 * `skewSeconds` is how much clock skew / in-flight latency we budget for.
 */
export function shouldRefreshBeforeUse(
  expiresAt: number | null | undefined,
  nowMs: number = Date.now(),
  skewSeconds: number = 60,
): boolean {
  if (!expiresAt || Number.isNaN(expiresAt)) return false;
  return expiresAt * 1000 - nowMs < skewSeconds * 1000;
}