import { Link, useRouterState, useMatches } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Flag,
  Shield,
  Calendar,
  BookOpen,
  Users,
  Gavel,
  Wallet,
  Settings,
  MessageSquare,
  Newspaper,
  Users2,
  Sparkles,
  CreditCard,
  Receipt,
  Handshake,
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
      { to: "/admin/transformations", label: "Transformations", icon: Sparkles, exact: false, permission: "manage_transformations" },
    ],
  },
  {
    label: "Coaching",
    items: [
      { to: "/admin/coaching", label: "Coaching requests", icon: Handshake, exact: false, permission: "manage_coaching" },
      { to: "/admin/disputes", label: "Coaching disputes", icon: Gavel, exact: false, permission: "manage_disputes" },
    ],
  },
  {
    label: "Trust & Safety",
    items: [
      { to: "/admin/moderation", label: "Reports & moderation", icon: Flag, exact: false, permission: "moderation" },
      { to: "/admin/strikes", label: "Trainer strikes", icon: AlertTriangle, exact: false, permission: "manage_strikes" },
      { to: "/admin/audit-logs", label: "Audit logs", icon: ScrollText, exact: false, permission: "view_audit_logs" },
    ],
  },
  {
    label: "Commerce",
    items: [
      { to: "/admin/classes", label: "Classes", icon: Calendar, exact: false, permission: "manage_classes" },
      { to: "/admin/bookings", label: "Bookings", icon: BookOpen, exact: false, permission: "manage_bookings" },
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
      { to: "/admin/payment-settings", label: "Payment settings", icon: Wallet, exact: false, permission: "manage_payment_settings" },
      { to: "/admin/security", label: "Security & system", icon: Lock, exact: false, permission: "manage_security" },
      { to: "/admin/payments", label: "Payments config", icon: Wallet, exact: false, permission: "manage_payments" },
      { to: "/admin/demo", label: "Demo content", icon: Database, exact: false, permission: "manage_demo" },
    ],
  },
];

export function AdminSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  // Auto-close the mobile drawer after navigation.
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isMobile]);
  const matches = useMatches();
  const adminMatch = matches.find(
    (m) => m.routeId === "/_authenticated/admin",
  ) as { context?: { permissions?: AdminPermission[] } } | undefined;
  const permissions = adminMatch?.context?.permissions ?? [];
  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => permissions.includes(i.permission)) }))
    .filter((g) => g.items.length > 0);

  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        {!collapsed && (
          <div>
            <span className="font-display text-[10px] uppercase tracking-[0.3em] text-primary">
              LEER Sports
            </span>
            <p className="mt-1 font-display text-sm uppercase tracking-tight">
              Admin panel
            </p>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        {visibleGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
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
                        className="data-[active=true]:border-l-2 data-[active=true]:border-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-semibold"
                      >
                        <Link to={item.to as any} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span>{item.label}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}