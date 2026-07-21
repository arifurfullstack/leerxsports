import type { AppRole } from "./schemas";

export type AdminPermission =
  | "view_overview"
  | "manage_applications"
  | "moderation"
  | "manage_roles"
  | "manage_classes"
  | "manage_bookings"
  | "manage_users"
  | "manage_disputes"
  | "manage_payments"
  | "manage_settings"
  | "manage_posts"
  | "manage_comments"
  | "manage_community"
  | "manage_transformations"
  | "manage_subscriptions"
  | "manage_transactions"
  | "manage_coaching"
  | "manage_notifications"
  | "manage_demo"
  | "view_refunds"
  | "view_tips"
  | "view_earnings"
  | "manage_payouts"
  | "manage_strikes"
  | "view_audit_logs"
  | "manage_countries"
  | "manage_languages"
  | "manage_categories"
  | "manage_policies"
  | "view_analytics"
  | "manage_payment_settings"
  | "manage_security";

export const ADMIN_PERMISSIONS: AdminPermission[] = [
  "view_overview",
  "manage_applications",
  "moderation",
  "manage_roles",
  "manage_classes",
  "manage_bookings",
  "manage_users",
  "manage_disputes",
  "manage_payments",
  "manage_settings",
  "manage_posts",
  "manage_comments",
  "manage_community",
  "manage_transformations",
  "manage_subscriptions",
  "manage_transactions",
  "manage_coaching",
  "manage_notifications",
  "manage_demo",
  "view_refunds",
  "view_tips",
  "view_earnings",
  "manage_payouts",
  "manage_strikes",
  "view_audit_logs",
  "manage_countries",
  "manage_languages",
  "manage_categories",
  "manage_policies",
  "view_analytics",
  "manage_payment_settings",
  "manage_security",
];

export const MODERATOR_PERMISSIONS: AdminPermission[] = [
  "view_overview",
  "manage_applications",
  "moderation",
  "manage_bookings",
  "manage_disputes",
  "manage_posts",
  "manage_comments",
  "manage_community",
  "manage_transformations",
  "manage_coaching",
  "view_refunds",
  "view_tips",
  "view_earnings",
  "manage_strikes",
  "view_audit_logs",
  "view_analytics",
];

/** Map admin route pathnames to the permission they require. */
const PATH_PERMISSIONS: Record<string, AdminPermission> = {
  "/admin": "view_overview",
  "/admin/trainers": "manage_applications",
  "/admin/moderation": "moderation",
  "/admin/roles": "manage_roles",
  "/admin/classes": "manage_classes",
  "/admin/bookings": "manage_bookings",
  "/admin/users": "manage_users",
  "/admin/disputes": "manage_disputes",
  "/admin/payments": "manage_payments",
  "/admin/settings": "manage_settings",
  "/admin/posts": "manage_posts",
  "/admin/comments": "manage_comments",
  "/admin/community": "manage_community",
  "/admin/transformations": "manage_transformations",
  "/admin/subscriptions": "manage_subscriptions",
  "/admin/transactions": "manage_transactions",
  "/admin/coaching": "manage_coaching",
  "/admin/notifications": "manage_notifications",
  "/admin/demo": "manage_demo",
  "/admin/refunds": "view_refunds",
  "/admin/tips": "view_tips",
  "/admin/earnings": "view_earnings",
  "/admin/payouts": "manage_payouts",
  "/admin/strikes": "manage_strikes",
  "/admin/audit-logs": "view_audit_logs",
  "/admin/countries": "manage_countries",
  "/admin/languages": "manage_languages",
  "/admin/categories": "manage_categories",
  "/admin/policies": "manage_policies",
  "/admin/analytics": "view_analytics",
  "/admin/payment-settings": "manage_payment_settings",
  "/admin/security": "manage_security",
};

/**
 * Order matches the admin sidebar. Used to pick the first admin page a user
 * has permission to access when they land on /admin without view_overview.
 */
export const ADMIN_NAV_ORDER: {
  path: string;
  permission: AdminPermission;
}[] = [
  { path: "/admin", permission: "view_overview" },
  { path: "/admin/users", permission: "manage_users" },
  { path: "/admin/trainers", permission: "manage_applications" },
  { path: "/admin/moderation", permission: "moderation" },
  { path: "/admin/disputes", permission: "manage_disputes" },
  { path: "/admin/roles", permission: "manage_roles" },
  { path: "/admin/posts", permission: "manage_posts" },
  { path: "/admin/comments", permission: "manage_comments" },
  { path: "/admin/community", permission: "manage_community" },
  { path: "/admin/transformations", permission: "manage_transformations" },
  { path: "/admin/classes", permission: "manage_classes" },
  { path: "/admin/bookings", permission: "manage_bookings" },
  { path: "/admin/subscriptions", permission: "manage_subscriptions" },
  { path: "/admin/transactions", permission: "manage_transactions" },
  { path: "/admin/refunds", permission: "view_refunds" },
  { path: "/admin/tips", permission: "view_tips" },
  { path: "/admin/earnings", permission: "view_earnings" },
  { path: "/admin/payouts", permission: "manage_payouts" },
  { path: "/admin/strikes", permission: "manage_strikes" },
  { path: "/admin/coaching", permission: "manage_coaching" },
  { path: "/admin/payments", permission: "manage_payments" },
  { path: "/admin/notifications", permission: "manage_notifications" },
  { path: "/admin/countries", permission: "manage_countries" },
  { path: "/admin/languages", permission: "manage_languages" },
  { path: "/admin/categories", permission: "manage_categories" },
  { path: "/admin/policies", permission: "manage_policies" },
  { path: "/admin/analytics", permission: "view_analytics" },
  { path: "/admin/audit-logs", permission: "view_audit_logs" },
  { path: "/admin/payment-settings", permission: "manage_payment_settings" },
  { path: "/admin/security", permission: "manage_security" },
  { path: "/admin/demo", permission: "manage_demo" },
  { path: "/admin/settings", permission: "manage_settings" },
];

/** First admin path the given permission set can access, or null. */
export function firstAccessibleAdminPath(
  permissions: AdminPermission[],
): string | null {
  const entry = ADMIN_NAV_ORDER.find((n) => permissions.includes(n.permission));
  return entry ? entry.path : null;
}

export function permissionsForRole(
  role: AppRole | null,
  isAdmin: boolean,
): AdminPermission[] {
  if (isAdmin || role === "admin") return [...ADMIN_PERMISSIONS];
  if (role === "moderator") return [...MODERATOR_PERMISSIONS];
  return [];
}

export function permissionForPath(pathname: string): AdminPermission | null {
  if (PATH_PERMISSIONS[pathname]) return PATH_PERMISSIONS[pathname];
  // Nested paths (e.g. /admin/classes/new) inherit their parent's permission.
  for (const [prefix, perm] of Object.entries(PATH_PERMISSIONS)) {
    if (prefix !== "/admin" && pathname.startsWith(prefix + "/")) return perm;
  }
  return null;
}