import { useEffect, useState } from "react";
import { useNavigate, useMatches } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Search,
  LayoutDashboard,
  FileText,
  Flag,
  Shield,
  Calendar,
  BookOpen,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  adminListTrainerApplications,
  adminGetBookings,
} from "@/lib/admin-functions";
import { getClasses } from "@/lib/class-functions";
import type { AdminPermission } from "@/lib/admin-permissions";

type AdminRoute =
  | "/admin"
  | "/admin/trainers"
  | "/admin/moderation"
  | "/admin/roles"
  | "/admin/classes"
  | "/admin/bookings";

const PAGES: {
  to: AdminRoute;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: AdminPermission;
  keywords: string;
}[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, permission: "view_overview", keywords: "home dashboard analytics" },
  { to: "/admin/trainers", label: "Applications", icon: FileText, permission: "manage_applications", keywords: "trainer applications review" },
  { to: "/admin/moderation", label: "Moderation", icon: Flag, permission: "moderation", keywords: "reports flags safety" },
  { to: "/admin/roles", label: "Roles", icon: Shield, permission: "manage_roles", keywords: "users admin permissions" },
  { to: "/admin/classes", label: "Classes", icon: Calendar, permission: "manage_classes", keywords: "sports classes schedule" },
  { to: "/admin/bookings", label: "Bookings", icon: BookOpen, permission: "manage_bookings", keywords: "reservations attendees" },
];

export function AdminSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const matches = useMatches();
  const adminMatch = matches.find((m) => m.routeId === "/_authenticated/admin") as
    | { context?: { permissions?: AdminPermission[] } }
    | undefined;
  const permissions = adminMatch?.context?.permissions ?? [];
  const can = (p: AdminPermission) => permissions.includes(p);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const listApplications = useServerFn(adminListTrainerApplications);
  const listClasses = useServerFn(getClasses);
  const listBookings = useServerFn(adminGetBookings);

  const applicationsQ = useQuery({
    queryKey: ["admin-search", "applications"],
    queryFn: () => listApplications(),
    enabled: open && can("manage_applications"),
    staleTime: 30_000,
  });
  const classesQ = useQuery({
    queryKey: ["admin-search", "classes"],
    queryFn: () => listClasses(),
    enabled: open && can("manage_classes"),
    staleTime: 30_000,
  });
  const bookingsQ = useQuery({
    queryKey: ["admin-search", "bookings"],
    queryFn: () => listBookings(),
    enabled: open && can("manage_bookings"),
    staleTime: 30_000,
  });

  const go = (to: AdminRoute, hash?: string) => {
    setOpen(false);
    navigate({ to, hash });
  };

  const visiblePages = PAGES.filter((p) => can(p.permission));

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Open admin search"
        className="ml-auto h-8 gap-2 px-2 text-muted-foreground sm:w-64 sm:justify-between sm:px-3"
      >
        <span className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5" />
          <span className="hidden text-xs sm:inline">Search admin…</span>
        </span>
        <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages, applications, classes, bookings…" />
        <CommandList>
          <CommandEmpty>No matches found.</CommandEmpty>

          {visiblePages.length > 0 && (
            <CommandGroup heading="Pages">
              {visiblePages.map((p) => (
                <CommandItem
                  key={p.to}
                  value={`${p.label} ${p.keywords}`}
                  onSelect={() => go(p.to)}
                >
                  <p.icon className="mr-2 h-4 w-4" />
                  <span>{p.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {can("manage_applications") && (applicationsQ.data?.length ?? 0) > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Applications">
                {applicationsQ.data!.slice(0, 25).map((a) => {
                  const name = a.public_trainer_name || a.full_legal_name || "Untitled";
                  return (
                    <CommandItem
                      key={a.id}
                      value={`application ${name} ${a.status} ${a.country ?? ""}`}
                      onSelect={() => go("/admin/trainers", `app-${a.id}`)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      <span className="truncate">{name}</span>
                      <span className="ml-auto text-xs uppercase tracking-wide text-muted-foreground">
                        {a.status}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}

          {can("manage_classes") && (classesQ.data?.length ?? 0) > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Classes">
                {classesQ.data!.slice(0, 25).map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`class ${c.title} ${c.category ?? ""} ${c.instructor ?? ""}`}
                    onSelect={() => go("/admin/classes", `class-${c.id}`)}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    <span className="truncate">{c.title}</span>
                    {c.category && (
                      <span className="ml-auto text-xs uppercase tracking-wide text-muted-foreground">
                        {c.category}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {can("manage_bookings") && (bookingsQ.data?.length ?? 0) > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Bookings">
                {bookingsQ.data!.slice(0, 25).map((b) => {
                  const title = b.class?.title ?? "Class";
                  const email = b.user?.email ?? "";
                  return (
                    <CommandItem
                      key={b.id}
                      value={`booking ${title} ${email} ${b.status}`}
                      onSelect={() => go("/admin/bookings", `booking-${b.id}`)}
                    >
                      <BookOpen className="mr-2 h-4 w-4" />
                      <span className="truncate">
                        {title}
                        {email ? ` — ${email}` : ""}
                      </span>
                      <span className="ml-auto text-xs uppercase tracking-wide text-muted-foreground">
                        {b.status}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}