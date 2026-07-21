import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  sportsClassSchema,
  classBookingCountSchema,
  type SportsClass,
} from "./schemas";

function getPublicSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

export const getClasses = createServerFn({ method: "GET" }).handler(
  async (): Promise<SportsClass[]> => {
    const supabase = getPublicSupabase();
    const { data, error } = await supabase
      .from("sports_classes")
      .select(
        "id, title, slug, description, instructor, duration_minutes, capacity, schedule, location, level, category, image_url, price, is_active, created_at, updated_at",
      )
      .eq("is_active", true)
      .order("schedule", { ascending: true });

    if (error) throw new Error(error.message);
    return z.array(sportsClassSchema).parse(data ?? []);
  },
);

export const getClassBySlug = createServerFn({ method: "GET" })
  .validator((input) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }): Promise<SportsClass | null> => {
    const supabase = getPublicSupabase();
    const { data: row, error } = await supabase
      .from("sports_classes")
      .select(
        "id, title, slug, description, instructor, duration_minutes, capacity, schedule, location, level, category, image_url, price, is_active, created_at, updated_at",
      )
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return row ? sportsClassSchema.parse(row) : null;
  });

export const getBookingCounts = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ class_id: string; count: number }[]> => {
    const supabase = getPublicSupabase();
    const { data, error } = await supabase
      .from("bookings")
      .select("class_id, status")
      .neq("status", "cancelled");

    if (error) throw new Error(error.message);

    const counts = new Map<string, number>();
    for (const booking of data ?? []) {
      if (!booking.class_id) continue;
      counts.set(booking.class_id, (counts.get(booking.class_id) ?? 0) + 1);
    }

    return Array.from(counts.entries()).map(([class_id, count]) => ({
      class_id,
      count,
    }));
  },
);

export const getClassBookingCounts = createServerFn({ method: "POST" })
  .validator((input) => z.object({ classIds: z.array(z.string().uuid()) }).parse(input))
  .handler(async ({ data }): Promise<{ class_id: string; count: number }[]> => {
    const supabase = getPublicSupabase();
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("class_id")
      .in("class_id", data.classIds)
      .neq("status", "cancelled");

    if (error) throw new Error(error.message);

    const counts = new Map<string, number>();
    for (const booking of bookings ?? []) {
      if (!booking.class_id) continue;
      counts.set(booking.class_id, (counts.get(booking.class_id) ?? 0) + 1);
    }

    return Array.from(counts.entries()).map(([class_id, count]) => ({
      class_id,
      count,
    }));
  });
