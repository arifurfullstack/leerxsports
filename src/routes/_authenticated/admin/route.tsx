import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { ShieldAlert, LogIn, RefreshCw, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import {
  permissionsForRole,
  type AdminPermission,
} from "@/lib/admin-permissions";

function AdminPendingSkeleton() {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
          Loading Admin Workspace...
        </p>
      </div>
    </div>
  );
}

/**
 * Client-side guard for every /admin/* route.
 *
 * The parent `_authenticated` layout intentionally lets /admin render
 * without a session (so we can show a public admin landing page). That
 * exception means admin loaders can otherwise fire protected server
 * functions with no bearer token, producing a blank 401 screen.
 *
 * This layout re-checks the session before any admin loader runs and
 * bounces unauthenticated users to /auth with a redirect-back.
 */
export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/admin/login") {
      return;
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/admin/login" as any,
        search: {
          redirect: location.pathname + (location.searchStr ?? ""),
        } as any,
      });
    }
    // Load the user's roles so the sidebar can render only the sections
    // they are allowed to access.
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (roleRows ?? []).map((r) => r.role as string);
    const isAdmin = roles.includes("admin");
    const isModerator = roles.includes("moderator");

    // Strictly block non-admin / non-moderator users from backend pages!
    if (!isAdmin && !isModerator) {
      throw redirect({
        to: "/admin/login" as any,
        search: {
          error: "unauthorized",
          redirect: location.pathname + (location.searchStr ?? ""),
        } as any,
      });
    }

    const primary = (roles.find((r) => r === "admin" || r === "moderator") ??
      roles[0] ??
      null) as Parameters<typeof permissionsForRole>[0];
    const permissions: AdminPermission[] = permissionsForRole(primary, isAdmin);
    return { user: data.user, permissions, roles };
  },
  pendingComponent: AdminPendingSkeleton,
  component: AdminLayout,
  errorComponent: AdminAuthErrorBoundary,
});

import { AdminHeader } from "@/components/admin-header";

function AdminLayout() {
  return (
    <SidebarProvider className="min-h-dvh w-full bg-background p-2.5 sm:p-3.5 md:p-4 text-foreground">
      <div className="flex min-h-[calc(100dvh-2rem)] w-full gap-3 sm:gap-4">
        <AdminSidebar variant="floating" />
        <SidebarInset className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <AdminHeader />
          <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

/**
 * Classifies loader errors so we can render a friendly page instead of
 * the blank white/red default when an admin call is unauthenticated (401)
 * or the caller lacks the admin role (403).
 */
function classifyAuthError(error: unknown): "unauthorized" | "forbidden" | null {
  const msg =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "";
  const status =
    error && typeof error === "object" && "status" in error
      ? Number((error as { status?: unknown }).status)
      : null;

  if (status === 401 || /unauthor/i.test(msg) || /no authorization header/i.test(msg)) {
    return "unauthorized";
  }
  if (status === 403 || /forbidden/i.test(msg) || /admin access required/i.test(msg)) {
    return "forbidden";
  }
  return null;
}

function AdminAuthErrorBoundary({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const router = useRouter();
  const kind = classifyAuthError(error);

  if (!kind) {
    // Not an auth error — surface something useful instead of a blank screen.
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 p-8 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" aria-hidden />
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred while loading this admin page."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Try again
          </Button>
          <Button variant="outline" asChild>
            <Link to="/home">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const isUnauth = kind === "unauthorized";
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="h-7 w-7" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold">
        {isUnauth ? "You're signed out" : "Admin access required"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {isUnauth
          ? "Your session ended, so this admin page couldn't load. Sign in again to continue."
          : "You're signed in, but your account doesn't have the admin role needed to view this page."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {isUnauth ? (
          <Button asChild>
            <Link
              to={"/admin/login" as any}
              search={{
                redirect:
                  typeof window !== "undefined"
                    ? window.location.pathname + window.location.search
                    : "/admin",
              } as any}
            >
              <LogIn className="mr-2 h-4 w-4" /> Admin Sign in
            </Link>
          </Button>
        ) : (
          <Button asChild>
            <Link to="/home">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
            </Link>
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Try again
        </Button>
      </div>
    </div>
  );
}