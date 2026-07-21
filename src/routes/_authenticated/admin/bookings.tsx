import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { adminGetBookings } from "@/lib/admin-functions";
import { AdminBookingTable } from "@/components/admin-booking-table";
import { AdminNav } from "@/components/admin-nav";

const adminBookingsQueryOptions = queryOptions({
  queryKey: ["admin-bookings"],
  queryFn: () => adminGetBookings(),
});

export const Route = createFileRoute("/_authenticated/admin/bookings")({
  loader: ({ context }) => context.queryClient.ensureQueryData(adminBookingsQueryOptions),
  head: () => ({
    meta: [
      { title: "Admin — Bookings — leersports" },
      { name: "description", content: "View all leersports bookings." },
      { property: "og:title", content: "Admin — Bookings — leersports" },
      { property: "og:description", content: "View all leersports bookings." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AdminBookingsPage,
  errorComponent: AdminBookingsError,
  notFoundComponent: AdminBookingsNotFound,
});

function AdminBookingsPage() {
  const { data: bookings } = useSuspenseQuery(adminBookingsQueryOptions);

  return (
    <main className="min-h-dvh bg-background py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6">
          <span className="font-display text-xs uppercase tracking-[0.3em] text-primary">
            Admin
          </span>
          <h1 className="mt-1 font-display text-3xl uppercase tracking-tight">All bookings</h1>
          <AdminNav />
        </header>
        <AdminBookingTable bookings={bookings} />
      </div>
    </main>
  );
}

function AdminBookingsError({ error }: { error: Error }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Could not load bookings</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  );
}

function AdminBookingsNotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Page not found</h1>
      </div>
    </div>
  );
}
