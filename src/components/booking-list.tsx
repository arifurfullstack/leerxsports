import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { cancelBooking } from "@/lib/booking-functions";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Calendar, Clock, MapPin, Trash2 } from "lucide-react";
import type { bookingWithClassSchema } from "@/lib/schemas";
import type { z } from "zod";

interface BookingListProps {
  bookings: z.infer<typeof bookingWithClassSchema>[];
}

export function BookingList({ bookings }: BookingListProps) {
  const doCancel = useServerFn(cancelBooking);
  const queryClient = useQueryClient();
  const router = useRouter();

  const handleCancel = async (bookingId: string) => {
    if (!confirm("Cancel this booking?")) return;
    try {
      await doCancel({ data: { bookingId } });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Cancel failed");
    }
  };

  if (bookings.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">No upcoming bookings yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {bookings.map((booking) => {
        const date = new Date(booking.class.schedule);
        const isPast = date < new Date();
        return (
          <Card key={booking.id} className={isPast ? "opacity-70" : ""}>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold text-card-foreground">{booking.class.title}</h3>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {date.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    {" · "}
                    {booking.class.duration_minutes} min
                  </span>
                  {booking.class.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {booking.class.location}
                    </span>
                  )}
                </div>
              </div>
              {!isPast && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancel(booking.id)}
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
