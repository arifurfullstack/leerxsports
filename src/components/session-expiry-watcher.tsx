import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  buildExpiryRedirect,
  isProtectedPath,
  wasManualSignOut,
} from "@/lib/session-lifecycle";

/**
 * Watches for Supabase auth events that indicate the session was lost
 * involuntarily — refresh token expired, revoked, or the account was signed
 * out from another device. When that happens on a protected route, we tear
 * down cached protected data and bounce to `/auth` with a redirect back so
 * the user can re-authenticate and land where they were.
 *
 * TOKEN_REFRESHED (successful auto-refresh) is intentionally handled by
 * doing nothing — the app keeps running with the new access token.
 */
export function SessionExpiryWatcher() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hadSession = useRef(false);

  useEffect(() => {
    // Prime the "did we have a session" flag so the very first
    // INITIAL_SESSION with no user doesn't trip the expiry flow.
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        hadSession.current = !!data.session;
      })
      .catch(() => {});

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        hadSession.current = !!session;
        return;
      }
      if (event !== "SIGNED_OUT") return;

      const previouslyAuthed = hadSession.current;
      hadSession.current = false;

      // The user hit "Sign out" themselves — that handler owns the
      // cache teardown and navigation.
      if (wasManualSignOut()) return;
      // Never had a session in the first place (e.g. anonymous visitor).
      if (!previouslyAuthed) return;

      const pathname =
        typeof window !== "undefined" ? window.location.pathname : "/";

      // Silent on public pages — the managed `_authenticated` gate will
      // handle the redirect on the next protected navigation.
      if (!isProtectedPath(pathname)) return;

      void queryClient.cancelQueries();
      queryClient.clear();
      toast.info("Your session expired", {
        description: "Sign in again to pick up where you left off.",
      });
      router.navigate(buildExpiryRedirect(pathname));
    });

    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return null;
}