/**
 * Project-specific bearer middleware for serverFn calls.
 *
 * Replaces the generated `attachSupabaseAuth`. Proactively refreshes the
 * Supabase session when the access token is within `SKEW_SECONDS` of
 * expiry, so long-running tabs and cross-tab wakeups don't fire off
 * serverFn calls that 401 while the client-side auto-refresh is still
 * catching up.
 */
import { createMiddleware } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { supabase } from "./client";
import { shouldRefreshBeforeUse } from "@/lib/session-lifecycle";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    let token = data.session?.access_token;
    const expiresAt = data.session?.expires_at;

    if (token && shouldRefreshBeforeUse(expiresAt)) {
      const { data: refreshed, error } = await supabase.auth.refreshSession();
      if (!error && refreshed.session?.access_token) {
        token = refreshed.session.access_token;
      }
      // If refresh fails, fall through with the (soon-to-be-401) token.
      // supabase-js will emit SIGNED_OUT and the SessionExpiryWatcher will
      // bounce the user to /auth with a redirect back.
    }

    // If no token, proceed with empty headers. Public server functions will handle unauthenticated requests cleanly.
    if (!token) {
      return next({ headers: {} });
    }

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);