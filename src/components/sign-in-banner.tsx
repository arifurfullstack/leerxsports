import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Dumbbell, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Persistent "Sign in to unlock" banner shown to signed-out visitors on
 * public discovery routes. Hides itself once a session exists or the
 * viewer dismisses it (per-session, via sessionStorage).
 */
export function SignInBanner({
  message = "Sign in to unlock the full experience",
  sub = "Follow creators, save posts, tip, comment, and get a personalized feed.",
  storageKey = "leer:signin-banner-dismissed",
}: {
  message?: string;
  sub?: string;
  storageKey?: string;
} = {}) {
  const [state, setState] = useState<"loading" | "show" | "hidden">("loading");

  useEffect(() => {
    let cancelled = false;
    const dismissed =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(storageKey) === "1";

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) setState("hidden");
      else setState(dismissed ? "hidden" : "show");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setState("hidden");
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [storageKey]);

  if (state !== "show") return null;

  const redirect =
    typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : "/";

  return (
    <div
      role="region"
      aria-label="Sign in prompt"
      className="sticky top-16 z-30 mx-auto mb-4 w-full max-w-6xl px-3 sm:px-4"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/15 via-background/80 to-background/80 p-3 shadow-lg backdrop-blur-md sm:p-4">
        <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary sm:flex">
          <Dumbbell className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground sm:text-base">
            {message}
          </p>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            {sub}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
            <Link to="/auth" search={{ mode: "signup", redirect } as never}>
              Create account
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth" search={{ redirect } as never}>
              Sign in
            </Link>
          </Button>
          <button
            type="button"
            aria-label="Dismiss sign in prompt"
            onClick={() => {
              try {
                window.sessionStorage.setItem(storageKey, "1");
              } catch {}
              setState("hidden");
            }}
            className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}