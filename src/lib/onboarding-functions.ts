import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  traineeOnboardingSchema,
  trainerApplicationSchema,
  appRoleSchema,
  type AppRole,
} from "./schemas";

/** Return the signed-in user's role, primary profile fields, onboarding status and (if any) trainer application status. */
export const getOnboardingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [rolesRes, profileRes, appRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("profiles")
        .select(
          "username, display_name, full_name, avatar_url, country, native_language, onboarding_completed"
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("trainer_applications")
        .select("id, status, created_at, updated_at, admin_notes")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (rolesRes.error) throw new Error(rolesRes.error.message);
    if (profileRes.error) throw new Error(profileRes.error.message);
    if (appRes.error) throw new Error(appRes.error.message);

    const roles: AppRole[] = (rolesRes.data ?? [])
      .map((r) => appRoleSchema.safeParse(r.role))
      .filter((r): r is { success: true; data: AppRole } => r.success)
      .map((r) => r.data);

    return {
      userId,
      roles,
      isAdmin: roles.includes("admin"),
      isTrainer: roles.includes("trainer"),
      isTrainee: roles.includes("trainee") || roles.includes("user"),
      profile: profileRes.data ?? null,
      onboardingCompleted: !!profileRes.data?.onboarding_completed,
      trainerApplication: appRes.data ?? null,
    };
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureUsernameAvailable(supabase: any, userId: string, username: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .ilike("username", username)
    .neq("user_id", userId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  if (data) throw new Error("That username is already taken.");
}

export const completeTraineeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => traineeOnboardingSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await ensureUsernameAvailable(supabase, userId, data.username);

    const { error } = await supabase
      .from("profiles")
      .update({
        username: data.username.toLowerCase(),
        display_name: data.display_name,
        country: data.country,
        native_language: data.native_language,
        additional_languages: data.additional_languages,
        gender: data.gender ?? null,
        height_cm: data.height_cm ?? null,
        weight_kg: data.weight_kg ?? null,
        body_fat_percent: data.body_fat_percent ?? null,
        skeletal_muscle_kg: data.skeletal_muscle_kg ?? null,
        goal: data.goal ?? null,
        experience_level: data.experience_level,
        injuries: data.injuries ?? null,
        onboarding_completed: true,
        agreement_accepted_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitTrainerApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => trainerApplicationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Check no pending/resubmit app already exists
    const { data: existing, error: exErr } = await supabase
      .from("trainer_applications")
      .select("id, status")
      .eq("user_id", userId)
      .in("status", ["pending", "resubmit"])
      .maybeSingle();
    if (exErr && exErr.code !== "PGRST116") throw new Error(exErr.message);
    if (existing) throw new Error("You already have an application in review.");

    await ensureUsernameAvailable(supabase, userId, data.username);

    // Update profile with username + display name so the platform can reference them
    const { error: profErr } = await supabase
      .from("profiles")
      .update({
        username: data.username.toLowerCase(),
        display_name: data.display_name,
        country: data.country,
        native_language: data.native_language,
        additional_languages: data.additional_languages,
        onboarding_completed: true,
        agreement_accepted_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (profErr) throw new Error(profErr.message);

    const { data: inserted, error: insErr } = await supabase
      .from("trainer_applications")
      .insert({
        user_id: userId,
        full_legal_name: data.full_legal_name,
        public_trainer_name: data.public_trainer_name,
        country: data.country,
        native_language: data.native_language,
        additional_languages: data.additional_languages,
        specialties: data.specialties,
        years_experience: data.years_experience,
        biography: data.biography,
        certification_details: data.certification_details,
        certificates: data.certificates,
        id_doc_url: data.id_doc_url ?? null,
        social_links: data.social_links,
        requested_price: data.requested_price,
        payout_info: data.payout_info ? { note: data.payout_info } : {},
        status: "pending",
      })
      .select("id, status")
      .single();
    if (insErr) throw new Error(insErr.message);

    return { ok: true, application: inserted };
  });
