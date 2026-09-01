import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import {
  Search,
  LogOut,
  Settings,
  ShieldCheck,
  FileText,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { UserAvatar } from "@/components/user-avatar";
import { NotificationBell } from "@/components/notification-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export function AdminHeader() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        supabase
          .from("profiles")
          .select("avatar_url, avatar_urls")
          .eq("user_id", data.user.id)
          .maybeSingle()
          .then(({ data: prof }) => {
            const urls = (prof?.avatar_urls as { sm?: string; md?: string; lg?: string } | null) ?? null;
            const resolved =
              (prof?.avatar_url as string | null) ||
              urls?.sm ||
              urls?.md ||
              urls?.lg ||
              (data.user?.user_metadata?.avatar_url as string | null) ||
              null;
            setAvatarUrl(resolved);
          });
      }
    });
  }, []);

  const handleLogout = async () => {
    const { markManualSignOut } = await import("@/lib/session-lifecycle");
    markManualSignOut();
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/admin/login" as any, replace: true });
  };

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email ||
    "Admin User";

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.navigate({
      to: "/admin/users",
      search: { q: searchQuery.trim() } as any,
    });
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-background/90 px-3 backdrop-blur-md sm:px-6">
      {/* Left section: Sidebar trigger + Breadcrumbs + Status */}
      <div className="flex items-center gap-3">
        <SidebarTrigger
          aria-label="Toggle admin sidebar"
          className="h-9 w-9 rounded-md border border-border bg-muted/30 hover:bg-muted"
        />
        <div className="hidden h-4 w-px bg-border sm:block" />
        <AdminBreadcrumbs />
        <div className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400 lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>System Online</span>
        </div>
      </div>

      {/* Center: Admin Quick Search */}
      <form
        onSubmit={handleSearchSubmit}
        className="hidden max-w-xs flex-1 px-4 md:block lg:max-w-sm"
      >
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search users, trainers, orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full rounded-md border border-border/80 bg-muted/20 pl-8 text-xs placeholder:text-muted-foreground/70 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
      </form>

      {/* Right section: Shortcuts & Admin Profile */}
      <div className="flex items-center gap-2">
        <Link
          to="/admin/audit-logs"
          title="View Audit Logs"
          className="hidden h-8 items-center gap-1.5 rounded-md border border-border/60 bg-muted/20 px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground xl:flex"
        >
          <FileText className="h-3.5 w-3.5 text-primary" />
          <span>Audit Logs</span>
        </Link>

        <Link
          to="/admin/security"
          title="Security & System"
          className="hidden h-8 items-center gap-1.5 rounded-md border border-border/60 bg-muted/20 px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground xl:flex"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
          <span>Security</span>
        </Link>

        <NotificationBell />

        {/* Admin User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md border border-border/80 bg-muted/30 p-1 pl-1.5 pr-2 transition-colors hover:bg-muted focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Open admin profile menu"
            >
              <UserAvatar
                src={avatarUrl}
                name={displayName}
                size="sm"
                className="h-7 w-7 ring-1 ring-primary/40"
              />
              <div className="hidden flex-col text-left sm:flex">
                <span className="max-w-[120px] truncate text-xs font-semibold leading-none text-foreground">
                  {displayName}
                </span>
                <span className="text-[9px] font-mono uppercase tracking-wider text-primary">
                  Administrator
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex items-center gap-2 py-2">
              <UserAvatar src={avatarUrl} name={displayName} size="md" className="h-8 w-8" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">{displayName}</p>
                <p className="truncate text-[10px] font-mono uppercase text-primary">
                  Super Administrator
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link to="/admin/settings" className="flex w-full items-center text-xs">
                <Settings className="mr-2 h-4 w-4 text-muted-foreground" /> Platform Settings
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link to="/admin/security" className="flex w-full items-center text-xs">
                <ShieldCheck className="mr-2 h-4 w-4 text-amber-500" /> Security &amp; Keys
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link to="/admin/audit-logs" className="flex w-full items-center text-xs">
                <FileText className="mr-2 h-4 w-4 text-primary" /> Audit Logs
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleLogout}
              className="text-xs text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
