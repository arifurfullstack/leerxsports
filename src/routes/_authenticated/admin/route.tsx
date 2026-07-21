import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldOff, ShieldAlert, Home, LogIn, Mail } from "lucide-react";
import { isAdmin, getUserRole } from "@/lib/auth-functions";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminSearch } from "@/components/admin-search";
import { AdminMfaGate } from "@/components/admin-mfa-gate";
import {
  permissionsForRole,
  permissionForPath,
  firstAccessibleAdminPath,
} from "@/lib/admin-permissions";
import type { AppRole } from "@/lib/schemas";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context, location }) => {
    const ctx = context as { user?: { id: string } | null };
    if (!ctx.user) {
      return {
        isAdmin: false,
        signedIn: false,
        role: null as AppRole | null,
        permissions: [] as string[],
      };
    }
    const [admin, role] = await Promise.all([isAdmin(), getUserRole()]);
    const permissions = permissionsForRole(role, admin);
    const hasPanelAccess = admin || permissions.length > 0;
    // Hard-gate every admin sub-route by required permission.
    // Only the /admin landing renders the friendly "access denied" screen.
    if (location.pathname === "/admin") {
      // If the user has panel access but not the overview permission,
      // send them to the first sidebar page they can actually reach.
      if (hasPanelAccess && !permissions.includes("view_overview")) {
        const target = firstAccessibleAdminPath(permissions);
        if (target && target !== "/admin") {
          throw redirect({ to: target });
        }
      }
    } else {
      const required = permissionForPath(location.pathname);
      if (!hasPanelAccess || (required && !permissions.includes(required))) {
        // Prefer redirecting to a page the user CAN access; fall back to
        // /admin (which will render the access-denied screen).
        const target = firstAccessibleAdminPath(permissions) ?? "/admin";
        throw redirect({ to: target });
      }
    }
    return { isAdmin: admin, signedIn: true, role, permissions };
  },
  component: AdminGate,
});

function AdminGate() {
  const { isAdmin: allowed, signedIn, permissions } = Route.useRouteContext() as {
    isAdmin: boolean;
    signedIn: boolean;
    permissions: string[];
  };
  if (!signedIn) return <PublicAdminLanding />;
  if (allowed || permissions.length > 0) return <AdminShell />;
  return <AccessDenied />;
}

function AdminShell() {
  const defaultOpen =
    typeof document !== "undefined"
      ? document.cookie
          .split("; ")
          .find((c) => c.startsWith("sidebar:state="))
          ?.split("=")[1] !== "false"
      : true;
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <div className="flex min-h-dvh w-full bg-background">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur">
            <SidebarTrigger aria-label="Toggle admin navigation" />
            <span className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Admin
            </span>
            <AdminSearch />
          </header>
          <main className="min-w-0 flex-1">
            <AdminMfaGate>
              <Outlet />
            </AdminMfaGate>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function PublicAdminLanding() {
  const [seconds, setSeconds] = useState(5);
  useEffect(() => {
    if (seconds <= 0) {
      window.location.assign("/auth?intent=admin");
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="mt-5 font-display text-2xl uppercase tracking-tight">
          Admins only
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The admin panel is restricted to accounts with the{" "}
          <strong className="text-foreground">admin</strong> role. Please sign
          in to continue.
        </p>
        <p
          className="mt-4 text-xs uppercase tracking-widest text-muted-foreground"
          aria-live="polite"
        >
          Redirecting to sign-in in {seconds}s…
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/auth" search={{ intent: "admin" }}>
              <LogIn className="mr-2 h-4 w-4" />
              Sign in now
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              Back to home
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

function AccessDenied() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldOff className="h-7 w-7" />
        </div>
        <h1 className="mt-5 font-display text-2xl uppercase tracking-tight">
          Admin access only
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You&rsquo;re signed in, but this account doesn&rsquo;t have the{" "}
          <strong className="text-foreground">admin</strong> role, so the admin
          panel is off-limits.
        </p>
        <div className="mt-6 rounded-md border border-border/60 bg-muted/40 p-4 text-left text-sm">
          <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">
            What to do next
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
            <li>
              Sign in with an account that already has the admin role, or
            </li>
            <li>
              Ask an existing admin to promote your account from{" "}
              <code className="rounded bg-background px-1 py-0.5 font-mono text-xs">
                /admin/roles
              </code>
              .
            </li>
            <li>
              No admin exists yet? Seed one from the admin panel or use the
              demo admin{" "}
              <code className="rounded bg-background px-1 py-0.5 font-mono text-xs">
                admin@leerdemo.local
              </code>
              .
            </li>
          </ul>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/dashboard">
              <Home className="mr-2 h-4 w-4" />
              Go to dashboard
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/auth" search={{ intent: "admin" }}>
              <LogIn className="mr-2 h-4 w-4" />
              Switch account
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/settings">
              <Mail className="mr-2 h-4 w-4" />
              Contact support
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
