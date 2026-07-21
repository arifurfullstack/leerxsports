import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sportsClassSchema, bookingWithClassSchema } from "./schemas";
import type { SportsClass } from "./schemas";

export const getUserBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("bookings")
      .select(
        `id, user_id, class_id, status, booked_at, class:sports_classes!inner(id, title, slug, description, instructor, duration_minutes, capacity, schedule, location, level, category, image_url, price, is_active, created_at, updated_at)`,
      )
      .eq("user_id", context.userId)
      .neq("status", "cancelled")
      .order("booked_at", { ascending: false });

    if (error) throw new Error(error.message);
    return z.array(bookingWithClassSchema).parse(data ?? []);
  });

export const bookClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ classId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // 1. Load the class
    const { data: classRow, error: classError } = await context.supabase
      .from("sports_classes")
      .select("*")
      .eq("id", data.classId)
      .eq("is_active", true)
      .single();

    if (classError || !classRow) {
      throw new Error("Class not found or not available");
    }

    const sportsClass = sportsClassSchema.parse(classRow);

    if (new Date(sportsClass.schedule) < new Date()) {
      throw new Error("This class has already started");
    }

    // 2. Count existing non-cancelled bookings
    const { count, error: countError } = await context.supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("class_id", data.classId)
      .neq("status", "cancelled");

    if (countError) throw new Error(countError.message);
    if ((count ?? 0) >= sportsClass.capacity) {
      throw new Error("This class is full");
    }

    // 3. Check user does not already have a confirmed booking
    const { data: existing, error: existingError } = await context.supabase
      .from("bookings")
      .select("id, status")
      .eq("class_id", data.classId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);
    if (existing && existing.status === "confirmed") {
      throw new Error("You are already booked for this class");
    }

    if (existing && existing.status === "cancelled") {
      // Re-activate a cancelled booking
      const { error: updateError } = await context.supabase
        .from("bookings")
        .update({ status: "confirmed", booked_at: new Date().toISOString() })
        .eq("id", existing.id);

      if (updateError) throw new Error(updateError.message);
      return { success: true, bookingId: existing.id };
    }

    // 4. Insert new booking
    const { data: booking, error: insertError } = await context.supabase
      .from("bookings")
      .insert({
        class_id: data.classId,
        user_id: context.userId,
        status: "confirmed",
      })
      .select("id")
      .single();

    if (insertError) throw new Error(insertError.message);
    return { success: true, bookingId: booking.id };
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", data.bookingId)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { success: true };
  });
