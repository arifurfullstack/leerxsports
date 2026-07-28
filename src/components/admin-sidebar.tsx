import { Link, useNavigate, useRouterState, useMatches } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  Flag,
  Shield,
  Calendar,
  BookOpen,
  Users,
  Wallet,
  Settings,
  MessageSquare,
  Newspaper,
  Users2,
  Trophy,
  CreditCard,
  Receipt,
  Bell,
  Database,
  BadgeCheck,
  RotateCcw,
  Coins,
  PiggyBank,
  Banknote,
  AlertTriangle,
  ScrollText,
  Globe,
  Languages as LanguagesIcon,
  Dumbbell,
  BarChart3,
  Lock,
  X,
  Search,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AdminPermission } from "@/lib/admin-permissions";

type AdminItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact: boolean;
  permission: AdminPermission;
};

const groups: { label: string; items: AdminItem[] }[] = [
  {
    label: "Overview",
    items: [
      { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true, permission: "view_overview" },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/admin/users", label: "Users", icon: Users, exact: false, permission: "manage_users" },
      { to: "/admin/trainers", label: "Trainer applications & verified", icon: BadgeCheck, exact: false, permission: "manage_applications" },
      { to: "/admin/roles", label: "Admin users & roles", icon: Shield, exact: false, permission: "manage_roles" },
    ],
  },
  {
    label: "Content",
    items: [
      { to: "/admin/posts", label: "Posts", icon: Newspaper, exact: false, permission: "manage_posts" },
      { to: "/admin/comments", label: "Comments", icon: MessageSquare, exact: false, permission: "manage_comments" },
      { to: "/admin/community", label: "Community", icon: Users2, exact: false, permission: "manage_community" },
      { to: "/admin/transformations", label: "Transformations", icon: Trophy, exact: false, permission: "manage_transformations" },
    ],
  },
  {
    label: "Trust & Safety",
    items: [
      { to: "/admin/reports", label: "Reports queue", icon: Flag, exact: false, permission: "moderation" },
      { to: "/admin/moderation", label: "Moderation hub", icon: Flag, exact: false, permission: "moderation" },
      { to: "/admin/strikes", label: "Trainer strikes", icon: AlertTriangle, exact: false, permission: "manage_strikes" },
      { to: "/admin/audit-logs", label: "Audit logs", icon: ScrollText, exact: false, permission: "view_audit_logs" },
    ],
  },
  {
    label: "Commerce",
    items: [
      { to: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard, exact: false, permission: "manage_subscriptions" },
      { to: "/admin/transactions", label: "Transactions", icon: Receipt, exact: false, permission: "manage_transactions" },
      { to: "/admin/refunds", label: "Refunds", icon: RotateCcw, exact: false, permission: "view_refunds" },
      { to: "/admin/tips", label: "Tips", icon: Coins, exact: false, permission: "view_tips" },
      { to: "/admin/earnings", label: "Trainer earnings", icon: PiggyBank, exact: false, permission: "view_earnings" },
      { to: "/admin/payouts", label: "Payouts", icon: Banknote, exact: false, permission: "manage_payouts" },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/notifications", label: "Notifications", icon: Bell, exact: false, permission: "manage_notifications" },
      { to: "/admin/countries", label: "Countries", icon: Globe, exact: false, permission: "manage_countries" },
      { to: "/admin/languages", label: "Languages", icon: LanguagesIcon, exact: false, permission: "manage_languages" },
      { to: "/admin/categories", label: "Fitness categories", icon: Dumbbell, exact: false, permission: "manage_categories" },
      { to: "/admin/policies", label: "Agreements & policies", icon: ScrollText, exact: false, permission: "manage_policies" },
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3, exact: false, permission: "view_analytics" },
      { to: "/admin/settings", label: "Platform settings", icon: Settings, exact: false, permission: "manage_settings" },
      { to: "/admin/website", label: "Website settings", icon: Globe, exact: false, permission: "manage_settings" },
      { to: "/admin/website-preview", label: "Website preview", icon: Globe, exact: false, permission: "manage_settings" },
      { to: "/admin/payment-settings", label: "Payment settings", icon: Wallet, exact: false, permission: "manage_payment_settings" },
      { to: "/admin/payment-gateways", label: "Payment gateways", icon: Wallet, exact: false, permission: "manage_payment_gateways" },
      { to: "/admin/webhooks", label: "Payment webhooks", icon: Wallet, exact: false, permission: "manage_webhooks" },
      { to: "/admin/security", label: "Security & system", icon: Lock, exact: false, permission: "manage_security" },
      { to: "/admin/payments", label: "Payments config", icon: Wallet, exact: false, permission: "manage_payments" },
      { to: "/admin/demo", label: "Demo content", icon: Database, exact: false, permission: "manage_demo" },
    ],
  },
];

export function AdminSidebar({
  variant = "floating",
  className,
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Auto-close the mobile drawer after navigation.
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
    setQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isMobile]);
  // Cmd/Ctrl+K focuses the sidebar search.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const matches = useMatches();
  const adminMatch = matches.find(
    (m) => m.routeId === "/_authenticated/admin",
  ) as { context?: { permissions?: AdminPermission[] } } | undefined;
  const permissions = adminMatch?.context?.permissions ?? [];
  const q = query.trim().toLowerCase();
  const visibleGroups = useMemo(() => {
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) =>
            permissions.includes(i.permission) &&
            (!q ||
              i.label.toLowerCase().includes(q) ||
              g.label.toLowerCase().includes(q) ||
              i.to.toLowerCase().includes(q)),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [permissions, q]);
  const firstMatch = visibleGroups[0]?.items[0];

  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <Sidebar variant={variant} collapsible="icon" className={cn("border-border/80 bg-card shadow-sm rounded-xl overflow-hidden", className)} {...props}>
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center justify-between gap-2">
          {!collapsed && (
            <div className="min-w-0">
              <span className="font-display text-[10px] uppercase tracking-[0.3em] text-primary">
                LEER Sports
              </span>
              <p className="mt-1 font-display text-sm uppercase tracking-tight">
                Admin panel
              </p>
            </div>
          )}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Close menu"
              onClick={() => setOpenMobile(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarHeader>
      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && firstMatch) {
                  e.preventDefault();
                  setQuery("");
                  navigate({ to: firstMatch.to as any });
                } else if (e.key === "Escape") {
                  setQuery("");
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Search sections…"
              aria-label="Search admin sections"
              className="h-8 pl-7 pr-12 text-xs"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 select-none items-center gap-0.5 rounded border border-border bg-muted/60 px-1 font-mono text-[10px] text-muted-foreground sm:inline-flex">
              ⌘K
            </kbd>
          </div>
        </div>
      )}
      <SidebarContent>
        {!collapsed && q && visibleGroups.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            No sections match “{query}”.
          </div>
        )}
        {visibleGroups.map((group) => {
          const groupActive = group.items.some((i) => isActive(i.to, i.exact));
          return (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel
              className={groupActive ? "text-primary" : undefined}
            >
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isActive(item.to, item.exact);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        aria-current={active ? "page" : undefined}
                        className="group/ai relative overflow-hidden transition-all duration-200 hover:translate-x-0.5 hover:bg-primary/5 data-[active=true]:bg-primary/15 data-[active=true]:text-primary data-[active=true]:font-semibold data-[active=true]:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)] hover:data-[active=true]:bg-primary/20"
                      >
                        <Link to={item.to as any} className="relative flex items-center gap-2">
                          <span
                            aria-hidden
                            className={`absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-primary transition-all duration-200 ${
                              active
                                ? "h-5 w-1 opacity-100"
                                : "h-4 w-0.5 opacity-0 group-hover/ai:opacity-70"
                            }`}
                          />
                          <item.icon
                            className={`h-4 w-4 transition-transform duration-200 group-hover/ai:scale-110 ${
                              active ? "text-primary" : "group-hover/ai:text-primary"
                            }`}
                          />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                          {active && !collapsed && (
                            <span
                              aria-hidden
                              className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]"
                            />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}