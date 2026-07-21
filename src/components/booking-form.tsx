import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { bookClass } from "@/lib/booking-functions";
import { Button } from "./ui/button";
import { CheckCircle } from "lucide-react";

interface BookingFormProps {
  classId: string;
  isFull: boolean;
  isBooked: boolean;
}

export function BookingForm({ classId, isFull, isBooked }: BookingFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const doBook = useServerFn(bookClass);
  const queryClient = useQueryClient();
  const router = useRouter();

  const handleBook = async () => {
    setLoading(true);
    setError(null);
    try {
      await doBook({ data: { classId } });
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-lg border border-sport/20 bg-sport/10 p-4 text-sport">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          <span className="font-medium">You are booked!</span>
        </div>
        <p className="mt-1 text-sm">See your booking on your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        className="w-full"
        size="lg"
        onClick={handleBook}
        disabled={isFull || isBooked || loading}
        variant={isBooked ? "secondary" : "default"}
      >
        {loading
          ? "Booking..."
          : isBooked
            ? "Already booked"
            : isFull
              ? "Class full"
              : "Book this class"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
