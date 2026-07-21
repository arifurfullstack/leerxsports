import { Calendar, Clock, MapPin } from "lucide-react";
import type { z } from "zod";
import type { adminBookingWithUserSchema } from "@/lib/schemas";

interface AdminBookingTableProps {
  bookings: z.infer<typeof adminBookingWithUserSchema>[];
}

export function AdminBookingTable({ bookings }: AdminBookingTableProps) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        No bookings yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Class</th>
            <th className="px-4 py-3 font-medium">User</th>
            <th className="px-4 py-3 font-medium">Schedule</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Booked</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {bookings.map((booking) => {
            const date = new Date(booking.class.schedule);
            return (
              <tr key={booking.id}>
                <td className="px-4 py-3 font-medium text-card-foreground">
                  {booking.class.title}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{booking.user.email}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {date.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    <Clock className="ml-2 h-4 w-4" />
                    {booking.class.duration_minutes}m
                    {booking.class.location && (
                      <>
                        <MapPin className="ml-2 h-4 w-4" />
                        {booking.class.location}
                      </>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize">
                    {booking.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(booking.booked_at).toLocaleDateString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
