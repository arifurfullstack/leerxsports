import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyTrainerProfile = {
  is_trainer: boolean;
  username: string | null;
  display_name: string | null;
  full_name: string | null;
  bio: string | null;
  country: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  value_proposition: string;
  specialties: string[];
  subscription_price: number;
  monetization_enabled: boolean;
  dms_enabled: boolean;
  is_verified: boolean;
};

export const getMyTrainerProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyTrainerProfile> => {
    const { supabase, userId } = context;

    const [roleRes, profRes, tpRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("profiles")
        .select("username, display_name, full_name, bio, country, avatar_url, cover_url")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("trainer_profiles")
        .select(
          "value_proposition, specialties, subscription_price, monetization_enabled, dms_enabled, is_verified",
        )
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const isTrainer = (roleRes.data ?? []).some((r) => r.role === "trainer");
    const p = profRes.data;
    const tp = tpRes.data;

    return {
      is_trainer: isTrainer,
      username: p?.username ?? null,
      display_name: p?.display_name ?? null,
      full_name: p?.full_name ?? null,
      bio: p?.bio ?? null,
      country: p?.country ?? null,
      avatar_url: p?.avatar_url ?? null,
      cover_url: p?.cover_url ?? null,
      value_proposition: tp?.value_proposition ?? "",
      specialties: tp?.specialties ?? [],
      subscription_price: Number(tp?.subscription_price ?? 0),
      monetization_enabled: !!tp?.monetization_enabled,
      dms_enabled: tp?.dms_enabled ?? true,
      is_verified: !!tp?.is_verified,
    };
  });

const updateSchema = z.object({
  display_name: z.string().trim().min(1).max(80),
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_]+$/i, "letters, numbers, underscore only"),
  bio: z.string().trim().max(2000).optional().default(""),
  country: z.string().trim().max(80).optional().default(""),
  avatar_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  cover_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  value_proposition: z.string().trim().min(1).max(160),
  specialties: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  subscription_price: z.number().min(0).max(999),
  monetization_enabled: z.boolean(),
  dms_enabled: z.boolean(),
});

export const updateMyTrainerProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (!(roles ?? []).some((r) => r.role === "trainer")) {
      throw new Error("Only trainers can edit a trainer profile.");
    }

    // Ensure username uniqueness (case-insensitive)
    const { data: taken } = await supabase
      .from("profiles")
      .select("user_id")
      .ilike("username", data.username)
      .neq("user_id", userId)
      .maybeSingle();
    if (taken) throw new Error("That username is already taken.");

    const profileUpdate = {
      display_name: data.display_name,
      username: data.username,
      bio: data.bio || null,
      country: data.country || null,
      avatar_url: data.avatar_url ? data.avatar_url : null,
      cover_url: data.cover_url ? data.cover_url : null,
    };
    const { error: pErr } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("user_id", userId);
    if (pErr) throw new Error(pErr.message);

    const tpUpsert = {
      user_id: userId,
      value_proposition: data.value_proposition,
      specialties: data.specialties,
      subscription_price: data.subscription_price,
      monetization_enabled: data.monetization_enabled,
      dms_enabled: data.dms_enabled,
    };
    const { error: tErr } = await supabase
      .from("trainer_profiles")
      .upsert(tpUpsert, { onConflict: "user_id" });
    if (tErr) throw new Error(tErr.message);

    return { ok: true, username: data.username };
  });