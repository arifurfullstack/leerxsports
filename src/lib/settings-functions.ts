import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const profileUpdateSchema = z.object({
  display_name: z.string().min(1).max(80).optional(),
  bio: z.string().max(1000).nullable().optional(),
  country: z.string().max(80).nullable().optional(),
  native_language: z.string().max(20).nullable().optional(),
  preferred_language: z.string().max(20).nullable().optional(),
  profile_visibility: z.enum(["public", "subscribers", "private"]).optional(),
  transformation_visibility: z.enum(["public", "subscribers", "private"]).optional(),
});

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error: pErr } = await context.supabase
      .from("profiles")
      .select(
        "user_id, username, display_name, bio, country, native_language, preferred_language, profile_visibility, transformation_visibility, additional_languages",
      )
      .eq("user_id", context.userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);

    const { data: trainer } = await context.supabase
      .from("trainer_profiles")
      .select("user_id, dms_enabled")
      .eq("user_id", context.userId)
      .maybeSingle();

    return {
      profile,
      trainer: trainer ? { dms_enabled: trainer.dms_enabled } : null,
    };
  });

export const updateProfileSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => profileUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const patch: any = { updated_at: new Date().toISOString() };
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) patch[k] = v;
    }
    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z.object({ confirmation: z.literal("DELETE") }).parse(input),
  )
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const exportMyData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tables = [
      "profiles",
      "posts",
      "transformation_posts",
      "community_posts",
      "comments",
      "coaching_requests",
      "coaching_messages",
      "subscriptions",
      "tips",
      "notifications",
    ];
    const supa = context.supabase as any;
    const out: Record<string, any[]> = {};
    for (const t of tables) {
      const col =
        t === "coaching_requests" ? "subscriber_id"
        : t === "coaching_messages" ? "sender_id"
        : t === "subscriptions" ? "subscriber_id"
        : t === "tips" ? "from_user_id"
        : t === "posts" ? "trainer_id"
        : t === "community_posts" || t === "comments" ? "author_id"
        : "user_id";
      const { data } = await supa.from(t).select("*").eq(col, context.userId).limit(1000);
      out[t] = data ?? [];
    }
    // Serialize to a JSON string for safe cross-boundary transport
    return {
      exported_at: new Date().toISOString(),
      user_id: context.userId,
      json: JSON.stringify(out),
    };
  });