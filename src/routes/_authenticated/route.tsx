import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { resolveAuthIntent } from "@/lib/auth-intent";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // Let /admin render its own public landing before redirecting.
      if (location.pathname === "/admin") return { user: null };
      const intent = resolveAuthIntent(location.pathname);
      throw redirect({
        to: "/auth",
        search: {
          intent,
          redirect: location.pathname + (location.searchStr ?? ""),
        },
      });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
