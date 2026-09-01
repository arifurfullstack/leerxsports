import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { resolveAuthIntent } from "@/lib/auth-intent";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/admin/login") {
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      if (location.pathname.startsWith("/admin")) {
        throw redirect({
          to: "/admin/login" as any,
          search: { redirect: location.pathname + (location.searchStr ?? "") } as any,
        });
      }
      throw redirect({
        to: "/",
      });
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      if (location.pathname.startsWith("/admin")) {
        throw redirect({
          to: "/admin/login" as any,
          search: { redirect: location.pathname + (location.searchStr ?? "") } as any,
        });
      }
      throw redirect({
        to: "/",
      });
    }

    // Check user roles
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (roleRows ?? []).map((r) => r.role as string);
    const isAdmin = roles.includes("admin") || roles.includes("moderator");

    // Admin users can only access the backend /admin panel pages!
    if (isAdmin && !location.pathname.startsWith("/admin")) {
      throw redirect({
        to: "/admin",
      });
    }

    if (!isAdmin) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!profile?.onboarding_completed && location.pathname !== "/onboarding") {
        throw redirect({
          to: "/onboarding",
          search: { resume: undefined, source: undefined },
        });
      }
    }

    return { user: data.user, isAdmin };
  },
  component: () => <Outlet />,
});
