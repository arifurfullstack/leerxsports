import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  traineeOnboardingSchema,
  trainerApplicationSchema,
  appRoleSchema,
  type AppRole,
} from "./schemas";

/** Fire-and-forget audit log for trainer application flow. Never stores PII. */
async function logTrainerAppEvent(
  actorId: string | null,
  event: "attempt" | "success" | "failure" | "duplicate",
  metadata: Record<string, unknown> = {},
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const trunc = (v: string | null | undefined, n: number) =>
      v ? String(v).slice(0, n) : null;
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: actorId,
      action: `trainer_application.${event}`,
      target_table: "trainer_applications",
      target_id: null,
      metadata: {
        ...metadata,
        user_agent: trunc(getRequestHeader("user-agent") ?? null, 300),
        ip: trunc(getRequestIP({ xForwardedFor: true }) ?? null, 64),
        ts: new Date().toISOString(),
      },
    });
  } catch (err) {
    // Never let logging break the submit flow.
    console.error("[trainer-app-log] insert failed", err);
  }
}

/** Fire-and-forget audit log for onboarding flow events. Non-PII only. */
async function logOnboardingEvent(
  actorId: string | null,
  event: "skipped" | "resumed",
  metadata: Record<string, unknown> = {},
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const trunc = (v: string | null | undefined, n: number) =>
      v ? String(v).slice(0, n) : null;
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: actorId,
      action: `onboarding.${event}`,
      target_table: "profiles",
      target_id: null,
      metadata: {
        ...metadata,
        user_agent: trunc(getRequestHeader("user-agent") ?? null, 300),
        ip: trunc(getRequestIP({ xForwardedFor: true }) ?? null, 64),
        ts: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[onboarding-log] insert failed", err);
  }
}

/** Return the signed-in user's role, primary profile fields, onboarding status and (if any) trainer application status. */
export const getOnboardingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [rolesRes, profileRes, appRes, userRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("profiles")
        .select(
          "username, display_name, full_name, avatar_url, avatar_urls, country, native_language, onboarding_completed"
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("trainer_applications")
        .select("id, status, created_at, updated_at, admin_notes, full_legal_name, public_trainer_name, country, native_language, additional_languages, specialties, years_experience, biography, certification_details, certificates, id_doc_url, social_links, requested_price, payout_info")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.auth.getUser().catch(() => ({ data: { user: null }, error: null })),
    ]);

    if (rolesRes.error) throw new Error(rolesRes.error.message);
    if (profileRes.error) throw new Error(profileRes.error.message);
    if (appRes.error) throw new Error(appRes.error.message);

    const roles: AppRole[] = (rolesRes.data ?? [])
      .map((r) => appRoleSchema.safeParse(r.role))
      .filter((r): r is { success: true; data: AppRole } => r.success)
      .map((r) => r.data);

    const profileData = profileRes.data ?? null;

    return {
      userId,
      roles,
      isAdmin: roles.includes("admin"),
      isTrainer: roles.includes("trainer"),
      isTrainee: roles.includes("trainee") || roles.includes("user"),
      profile: profileData ?? {
        username: null,
        display_name: null,
        full_name: null,
        avatar_url: null,
        avatar_urls: null,
        country: null,
        native_language: null,
        onboarding_completed: false,
      },
      userMetadata: userRes.data?.user?.user_metadata ?? null,
      onboardingCompleted: !!profileData?.onboarding_completed,
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
  .validator((data) => traineeOnboardingSchema.parse(data))
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

/** Skip onboarding for now — mark profile as completed without collecting any details. */
export const skipOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { from_step?: "role" | "trainee" | "trainer" } | undefined) => ({
    from_step: data?.from_step && ["role", "trainee", "trainer"].includes(data.from_step)
      ? data.from_step
      : "unknown",
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: prof } = await supabase
      .from("profiles")
      .select("onboarding_completed, username, display_name")
      .eq("user_id", userId)
      .maybeSingle();

    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    await logOnboardingEvent(userId, "skipped", {
      from_step: data.from_step,
      was_completed: !!prof?.onboarding_completed,
      had_username: !!prof?.username,
      had_display_name: !!prof?.display_name,
    });

    return { ok: true };
  });

/** Record that a user re-entered the onboarding flow after skipping. */
export const logOnboardingResumed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { source?: string } | undefined) => {
    const allowed = ["dashboard_banner", "resume_param", "profile_incomplete", "unknown"];
    const src = data?.source && allowed.includes(data.source) ? data.source : "unknown";
    return { source: src };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("onboarding_completed, username, display_name")
      .eq("user_id", userId)
      .maybeSingle();
    await logOnboardingEvent(userId, "resumed", {
      source: data.source,
      was_completed: !!prof?.onboarding_completed,
      had_username: !!prof?.username,
      had_display_name: !!prof?.display_name,
    });
    return { ok: true };
  });

/** Return an onboarding progress summary + recent onboarding/trainer-app audit events for the signed-in user. */
export const getOnboardingProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profileRes, appRes] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "username, display_name, avatar_url, country, native_language, goal, onboarding_completed, agreement_accepted_at",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("trainer_applications")
        .select("id, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (profileRes.error) throw new Error(profileRes.error.message);
    if (appRes.error) throw new Error(appRes.error.message);

    const profile = profileRes.data ?? null;
    const app = appRes.data ?? null;

    const steps = [
      { id: "username", label: "Pick a username", done: !!profile?.username },
      { id: "display_name", label: "Set your display name", done: !!profile?.display_name },
      { id: "avatar", label: "Upload an avatar", done: !!profile?.avatar_url },
      { id: "country", label: "Add country & language", done: !!(profile?.country && profile?.native_language) },
      { id: "goal", label: "Share your current goal", done: !!profile?.goal },
      { id: "agreement", label: "Accept the community agreement", done: !!profile?.agreement_accepted_at },
    ];
    const completedCount = steps.filter((s) => s.done).length;
    const percent = Math.round((completedCount / steps.length) * 100);

    // audit_logs is admin-only; read via service role, but strictly filter to this actor.
    type SafeMeta = Record<string, string | number | boolean | null>;
    let events: Array<{
      id: string;
      action: string;
      created_at: string;
      metadata: SafeMeta;
    }> = [];
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("audit_logs")
        .select("id, action, created_at, metadata")
        .eq("actor_id", userId)
        .or("action.like.onboarding.%,action.like.trainer_application.%")
        .order("created_at", { ascending: false })
        .limit(10);
      events = (data ?? []).map((e) => ({
        id: e.id as string,
        action: e.action as string,
        created_at: e.created_at as string,
        // Strip potentially sensitive fields; keep only benign summary keys.
        metadata: pickSafeMetadata((e.metadata ?? {}) as Record<string, unknown>),
      }));
    } catch (err) {
      console.error("[onboarding-progress] audit read failed", err);
    }

    return {
      steps,
      completedCount,
      totalSteps: steps.length,
      percent,
      onboardingCompleted: !!profile?.onboarding_completed,
      trainerApplicationStatus: app?.status ?? null,
      events,
    };
  });

function pickSafeMetadata(
  md: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  const allow = [
    "from_step",
    "source",
    "stage",
    "was_completed",
    "had_username",
    "had_display_name",
    "existing_status",
    "specialties_count",
    "certificates_count",
    "social_links_count",
    "biography_length",
    "years_experience",
    "has_id_doc",
    "requested_price",
    "country",
    "ts",
  ];
  const out: Record<string, string | number | boolean | null> = {};
  for (const k of allow) {
    if (!(k in md)) continue;
    const v = md[k];
    if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else {
      out[k] = String(v);
    }
  }
  return out;
}

export const submitTrainerApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => trainerApplicationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Log attempt with non-PII shape summary only.
    const shape = {
      specialties_count: data.specialties.length,
      certificates_count: data.certificates.length,
      social_links_count: data.social_links.length,
      biography_length: data.biography.length,
      years_experience: data.years_experience,
      has_id_doc: Boolean(data.id_doc_url),
      has_payout_note: Boolean(data.payout_info),
      requested_price: data.requested_price,
      country: data.country,
    };
    await logTrainerAppEvent(userId, "attempt", shape);

    // Check no pending/resubmit app already exists
    const { data: existing, error: exErr } = await supabase
      .from("trainer_applications")
      .select("id, status")
      .eq("user_id", userId)
      .in("status", ["pending", "resubmit"])
      .maybeSingle();
    if (exErr && exErr.code !== "PGRST116") {
      await logTrainerAppEvent(userId, "failure", { stage: "existing_check", code: exErr.code });
      throw new Error(exErr.message);
    }
    if (existing) {
      await logTrainerAppEvent(userId, "duplicate", { existing_status: existing.status });
      throw new Error("You already have an application in review.");
    }

    try {
      await ensureUsernameAvailable(supabase, userId, data.username);
    } catch (err) {
      await logTrainerAppEvent(userId, "failure", {
        stage: "username_check",
        error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
      });
      throw err;
    }

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
    if (profErr) {
      await logTrainerAppEvent(userId, "failure", { stage: "profile_update", code: profErr.code });
      throw new Error(profErr.message);
    }

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
    if (insErr) {
      await logTrainerAppEvent(userId, "failure", { stage: "insert", code: insErr.code });
      throw new Error(insErr.message);
    }

    await logTrainerAppEvent(userId, "success", { application_id: inserted?.id ?? null });

    return { ok: true, application: inserted };
  });
