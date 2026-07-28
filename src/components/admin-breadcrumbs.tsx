import { Link, useRouterState } from "@tanstack/react-router";
import { Fragment, useMemo } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// Section (URL segment after /admin) → { section label, page label }.
// The section label groups related pages (matches the sidebar groups),
// the page label is the human name of the leaf route.
const PAGES: Record<string, { section: string; label: string }> = {
  users: { section: "People", label: "Users" },
  trainers: { section: "People", label: "Trainer applications" },
  roles: { section: "People", label: "Admin users & roles" },
  posts: { section: "Content", label: "Posts" },
  comments: { section: "Content", label: "Comments" },
  community: { section: "Content", label: "Community" },
  transformations: { section: "Content", label: "Transformations" },
  coaching: { section: "Coaching", label: "Coaching requests" },
  disputes: { section: "Coaching", label: "Coaching disputes" },
  reports: { section: "Trust & Safety", label: "Reports queue" },
  moderation: { section: "Trust & Safety", label: "Moderation hub" },
  strikes: { section: "Trust & Safety", label: "Trainer strikes" },
  "audit-logs": { section: "Trust & Safety", label: "Audit logs" },
  classes: { section: "Commerce", label: "Classes" },
  bookings: { section: "Commerce", label: "Bookings" },
  subscriptions: { section: "Commerce", label: "Subscriptions" },
  transactions: { section: "Commerce", label: "Transactions" },
  refunds: { section: "Commerce", label: "Refunds" },
  tips: { section: "Commerce", label: "Tips" },
  earnings: { section: "Commerce", label: "Trainer earnings" },
  payouts: { section: "Commerce", label: "Payouts" },
  notifications: { section: "System", label: "Notifications" },
  countries: { section: "System", label: "Countries" },
  languages: { section: "System", label: "Languages" },
  categories: { section: "System", label: "Fitness categories" },
  policies: { section: "System", label: "Agreements & policies" },
  analytics: { section: "System", label: "Analytics" },
  settings: { section: "System", label: "Platform settings" },
  "payment-settings": { section: "System", label: "Payment settings" },
  security: { section: "System", label: "Security & system" },
  payments: { section: "System", label: "Payments config" },
  demo: { section: "System", label: "Demo content" },
};

function humanize(segment: string) {
  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AdminBreadcrumbs() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const crumbs = useMemo(() => {
    const trail: { label: string; to?: string }[] = [{ label: "Admin", to: "/admin" }];
    const rest = pathname.replace(/^\/admin\/?/, "");
    if (!rest) return trail;
    const segments = rest.split("/").filter(Boolean);
    const first = segments[0];
    const meta = PAGES[first];
    if (meta) {
      trail.push({ label: meta.section });
      trail.push({ label: meta.label, to: `/admin/${first}` });
    } else {
      trail.push({ label: humanize(first), to: `/admin/${first}` });
    }
    // Nested segments (e.g. /admin/users/$id) → append humanized crumbs.
    for (let i = 1; i < segments.length; i++) {
      trail.push({ label: humanize(decodeURIComponent(segments[i])) });
    }
    return trail;
  }, [pathname]);

  return (
    <Breadcrumb>
      <BreadcrumbList className="text-xs">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${i}`}>
              <BreadcrumbItem>
                {isLast || !crumb.to ? (
                  <BreadcrumbPage className="max-w-[40vw] truncate">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.to as any} className="hover:text-foreground">
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}