import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

async function determineTarget(userId: string, defaultTo: string): Promise<string> {
  try {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (data) return "/admin";
  } catch {
    // ignore
  }
  return defaultTo;
}

/**
 * Client-side guard for public marketing/landing routes: if a Supabase
 * session exists, redirect to the appropriate workspace (/admin for admins, /home for trainees).
 */
export function RedirectIfAuthed({ to = "/home" }: { to?: string } = {}) {
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;

    const performRedirect = async (userId: string) => {
      const target = await determineTarget(userId, to);
      if (!cancelled) {
        navigate({ to: target, replace: true });
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session?.user?.id) {
        void performRedirect(data.session.user.id);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!cancelled && session?.user?.id && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        void performRedirect(session.user.id);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate, to]);

  return null;
}