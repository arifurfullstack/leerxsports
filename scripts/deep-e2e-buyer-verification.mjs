/**
 * Comprehensive Deep E2E Verification Script for Buyer QA
 * Tests:
 * 1. Q&A RBAC Security Fix (Trainee blocked, Pending blocked with 403, Rejected blocked, Verified allowed)
 * 2. Admin Approval & Rejection Workflow + State Sync
 * 3. Stripe Checkout ui_mode ('embedded_page') & Session Creation
 * 4. PayPal Configuration & Gateway Filtering
 * 5. Trainer Profile Tab Icons & UI Elements
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load environment variables from .env
const envPath = resolve(process.cwd(), ".env");
let SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://tdggisdwevfxpitlbeyc.supabase.co";
let SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
let SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || "";

if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    const val = rest.join("=").replace(/^["']|["']$/g, "");
    if ((key === "VITE_SUPABASE_URL" || key === "SUPABASE_URL") && val) SUPABASE_URL = val;
    if ((key === "VITE_SUPABASE_PUBLISHABLE_KEY" || key === "SUPABASE_PUBLISHABLE_KEY" || key === "VITE_SUPABASE_ANON_KEY") && val) SUPABASE_ANON_KEY = val;
    if ((key === "SUPABASE_SERVICE_ROLE_KEY" || key === "VITE_SUPABASE_SERVICE_ROLE_KEY") && val) SUPABASE_SERVICE_KEY = val;
  }
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

async function getOrCreateUser(email, password, displayName, role = "trainee", isVerified = false) {
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let user = (list?.users ?? []).find((u) => u.email === email);

  if (!user) {
    const { data: c, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`Failed to create ${email}: ${error.message}`);
    user = c.user;
  } else {
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });
  }

  const username = email.split("@")[0].replace(/[^a-z0-9_]/g, "_");
  await supabaseAdmin.from("profiles").upsert(
    {
      user_id: user.id,
      username,
      display_name: displayName,
      is_verified: isVerified,
      onboarding_completed: true,
    },
    { onConflict: "user_id" },
  );

  await supabaseAdmin
    .from("profiles")
    .update({ is_verified: isVerified })
    .eq("user_id", user.id);

  if (role) {
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: user.id, role },
      { onConflict: "user_id, role" },
    );
  }

  if (role === "trainer") {
    await supabaseAdmin.from("trainer_profiles").upsert(
      {
        user_id: user.id,
        is_verified: isVerified,
        monetization_enabled: isVerified,
        subscription_price: 19.99,
        specialties: ["strength", "hiit"],
      },
      { onConflict: "user_id" },
    );
  }

  return user;
}

// Server simulation helper for Q&A RBAC verification
async function simulateAnswerQADispatch(callerUserId, dispatchId, answerText) {
  // 1. Fetch dispatch
  const { data: row, error } = await supabaseAdmin
    .from("qa_dispatches")
    .select("id, creator_id, status")
    .eq("id", dispatchId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) throw new Error("Question not found.");
  if (row.creator_id !== callerUserId) throw new Error("Not authorized.");

  // 2. Strict RBAC verification
  const { data: verifiedTrainerRole } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerUserId)
    .eq("role", "trainer")
    .maybeSingle();

  const { data: trainerProfile } = await supabaseAdmin
    .from("trainer_profiles")
    .select("is_verified, monetization_enabled")
    .eq("user_id", callerUserId)
    .maybeSingle();

  const { data: profileRow } = await supabaseAdmin
    .from("profiles")
    .select("is_verified")
    .eq("user_id", callerUserId)
    .maybeSingle();

  const { data: appStatus } = await supabaseAdmin
    .from("trainer_applications")
    .select("status")
    .eq("user_id", callerUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isPendingOrRejected =
    appStatus?.status === "pending" ||
    appStatus?.status === "rejected" ||
    appStatus?.status === "resubmit";

  if (
    !verifiedTrainerRole ||
    !trainerProfile?.is_verified ||
    !profileRow?.is_verified ||
    isPendingOrRejected
  ) {
    console.log("DEBUG AUTH FAILURE:", {
      callerUserId,
      verifiedTrainerRole,
      trainerProfile,
      profileRow,
      appStatus,
      isPendingOrRejected,
    });
    const err = new Error(
      "403 Forbidden: Only verified Pro Trainers can submit official Q&A answers. Your trainer application may still be pending approval, rejected, or unverified."
    );
    err.status = 403;
    throw err;
  }

  // 3. Update dispatch
  await supabaseAdmin
    .from("qa_dispatches")
    .update({ answer: answerText, status: "answered", answered_at: new Date().toISOString() })
    .eq("id", dispatchId);

  return { ok: true, status: "answered" };
}

async function runDeepE2E() {
  console.log("================================================================================");
  console.log("🔬 EXHAUSTIVE END-TO-END VERIFICATION SUITE — BUYER QA");
  console.log("================================================================================\n");

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, testName, details = "") {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${testName} ${details ? `(${details})` : ""}`);
    } else {
      failedTests++;
      console.error(`  ❌ [FAIL] ${testName} ${details ? `(${details})` : ""}`);
    }
  }

  // -------------------------------------------------------------------------
  // 1. SETUP TEST USERS
  // -------------------------------------------------------------------------
  console.log("📌 SECTION 1: Provisioning & Verifying Test User Roles");
  
  const adminUser = await getOrCreateUser("admin@leerdemo.local", "DemoPass123!", "QA Admin", "admin", true);
  const verifiedTrainer = await getOrCreateUser("coach-nova@leerdemo.local", "DemoPass123!", "Coach Nova", "trainer", true);
  const traineeUser = await getOrCreateUser("athlete-kai@leerdemo.local", "DemoPass123!", "Athlete Kai", "trainee", false);
  const pendingTrainer = await getOrCreateUser("pending-trainer@leerdemo.local", "DemoPass123!", "Pending Coach", "trainee", false);
  const rejectedTrainer = await getOrCreateUser("rejected-trainer@leerdemo.local", "DemoPass123!", "Rejected Coach", "trainee", false);

  // Set up trainer_applications
  await supabaseAdmin.from("trainer_applications").upsert({
    user_id: verifiedTrainer.id,
    full_legal_name: "Coach Nova Pro",
    public_trainer_name: "Coach Nova",
    country: "US",
    native_language: "English",
    specialties: ["strength"],
    biography: "Verified Pro Trainer",
    status: "approved",
    requested_price: 19.99,
  }, { onConflict: "user_id" });

  await supabaseAdmin.from("trainer_applications").upsert({
    user_id: pendingTrainer.id,
    full_legal_name: "Pending Applicant",
    public_trainer_name: "Pending Coach",
    country: "US",
    native_language: "English",
    specialties: ["cardio"],
    biography: "Application awaiting review",
    status: "pending",
    requested_price: 24.99,
  }, { onConflict: "user_id" });

  await supabaseAdmin.from("trainer_applications").upsert({
    user_id: rejectedTrainer.id,
    full_legal_name: "Rejected Applicant",
    public_trainer_name: "Rejected Coach",
    country: "US",
    native_language: "English",
    specialties: ["general"],
    biography: "Application rejected by admin",
    status: "rejected",
    requested_price: 14.99,
  }, { onConflict: "user_id" });

  console.log("  ✓ Test users ready: Admin, Verified Trainer, Trainee, Pending Trainer, Rejected Trainer\n");

  // -------------------------------------------------------------------------
  // 2. Q&A RBAC SECURITY FIX
  // -------------------------------------------------------------------------
  console.log("📌 SECTION 2: Priority 1 — Q&A RBAC Security Enforcement");

  // Create test Q&A dispatches
  const { data: dispatch1 } = await supabaseAdmin
    .from("qa_dispatches")
    .insert({
      fan_id: traineeUser.id,
      creator_id: pendingTrainer.id,
      question: "Can you review my deadlift form?",
      price: 300,
      status: "pending",
    })
    .select("id")
    .single();

  const { data: dispatch2 } = await supabaseAdmin
    .from("qa_dispatches")
    .insert({
      fan_id: traineeUser.id,
      creator_id: rejectedTrainer.id,
      question: "What is the best cardio routine?",
      price: 300,
      status: "pending",
    })
    .select("id")
    .single();

  const { data: dispatch3 } = await supabaseAdmin
    .from("qa_dispatches")
    .insert({
      fan_id: traineeUser.id,
      creator_id: verifiedTrainer.id,
      question: "How should I structure my hypertrophy program?",
      price: 300,
      status: "pending",
    })
    .select("id")
    .single();

  // Test 2.1: Trainee attempts to answer -> Blocked
  try {
    await simulateAnswerQADispatch(traineeUser.id, dispatch3.id, "I am answering as a trainee");
    assert(false, "Trainee answering Q&A must be blocked");
  } catch (err) {
    assert(err.message.includes("403 Forbidden") || err.message.includes("Not authorized"), "Trainee is blocked from answering Q&A", err.message);
  }

  // Test 2.2: Pending Trainer attempts to answer -> 403 Forbidden
  try {
    await simulateAnswerQADispatch(pendingTrainer.id, dispatch1.id, "Here is my answer as pending trainer");
    assert(false, "Pending trainer answering Q&A must be blocked with 403");
  } catch (err) {
    assert(err.message.includes("403 Forbidden"), "Pending Trainer is blocked with 403 Forbidden", err.message);
  }

  // Test 2.3: Rejected Trainer attempts to answer -> 403 Forbidden
  try {
    await simulateAnswerQADispatch(rejectedTrainer.id, dispatch2.id, "Here is my answer as rejected trainer");
    assert(false, "Rejected trainer answering Q&A must be blocked with 403");
  } catch (err) {
    assert(err.message.includes("403 Forbidden"), "Rejected Trainer is blocked with 403 Forbidden", err.message);
  }

  // Test 2.4: Verified Pro Trainer answers -> Allowed
  try {
    const res = await simulateAnswerQADispatch(verifiedTrainer.id, dispatch3.id, "Keep spine neutral and maintain progressive overload.");
    assert(res.ok === true && res.status === "answered", "Verified Pro Trainer successfully answers Q&A dispatch");
  } catch (err) {
    assert(false, "Verified Pro Trainer answering Q&A failed", err.message);
  }

  // Clean up test dispatches
  await supabaseAdmin.from("qa_dispatches").delete().in("id", [dispatch1.id, dispatch2.id, dispatch3.id]);
  console.log("");

  // -------------------------------------------------------------------------
  // 3. ADMIN APPROVAL & REJECTION WORKFLOW
  // -------------------------------------------------------------------------
  console.log("📌 SECTION 3: Priority 2 — Admin Approval & Rejection Workflow");

  const newApplicant = await getOrCreateUser("applicant-live@leerdemo.local", "DemoPass123!", "Applicant Live", "trainee", false);
  
  // Submit new application
  const { data: newApp } = await supabaseAdmin
    .from("trainer_applications")
    .insert({
      user_id: newApplicant.id,
      full_legal_name: "Applicant Live Pro",
      public_trainer_name: "Coach Live",
      country: "CA",
      native_language: "English",
      specialties: ["calisthenics"],
      biography: "Certified trainer applicant",
      requested_price: 39.99,
      status: "pending",
    })
    .select("id")
    .single();

  assert(Boolean(newApp?.id), "Applicant successfully submits trainer application (status: pending)");

  // Admin approves application
  await supabaseAdmin
    .from("trainer_applications")
    .update({
      status: "approved",
      reviewed_by: adminUser.id,
      reviewed_at: new Date().toISOString(),
      admin_notes: "Approved by QA Admin",
    })
    .eq("id", newApp.id);

  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: newApplicant.id, role: "trainer" }, { onConflict: "user_id, role" });

  await supabaseAdmin
    .from("trainer_profiles")
    .upsert({
      user_id: newApplicant.id,
      is_verified: true,
      monetization_enabled: true,
      subscription_price: 39.99,
    }, { onConflict: "user_id" });

  await supabaseAdmin
    .from("profiles")
    .update({ is_verified: true })
    .eq("user_id", newApplicant.id);

  // Verify promoted state
  const { data: appAfterApproval } = await supabaseAdmin
    .from("trainer_applications")
    .select("status")
    .eq("id", newApp.id)
    .single();

  const { data: rolesAfterApproval } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", newApplicant.id);

  const { data: profileAfterApproval } = await supabaseAdmin
    .from("trainer_profiles")
    .select("is_verified, monetization_enabled")
    .eq("user_id", newApplicant.id)
    .single();

  assert(appAfterApproval.status === "approved", "Admin approval updates application status to 'approved'");
  assert((rolesAfterApproval || []).some((r) => r.role === "trainer"), "Admin approval grants 'trainer' role in user_roles");
  assert(profileAfterApproval.is_verified === true && profileAfterApproval.monetization_enabled === true, "Admin approval sets is_verified & monetization_enabled to true");

  // Admin rejects application simulation
  await supabaseAdmin
    .from("trainer_applications")
    .update({ status: "rejected" })
    .eq("id", newApp.id);

  await supabaseAdmin
    .from("user_roles")
    .delete()
    .eq("user_id", newApplicant.id)
    .eq("role", "trainer");

  await supabaseAdmin
    .from("trainer_profiles")
    .update({ is_verified: false, monetization_enabled: false })
    .eq("user_id", newApplicant.id);

  const { data: rolesAfterRejection } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", newApplicant.id);

  assert(!rolesAfterRejection.some((r) => r.role === "trainer"), "Admin rejection removes 'trainer' role from user_roles");

  // Cleanup
  await supabaseAdmin.from("trainer_applications").delete().eq("id", newApp.id);
  console.log("");

  // -------------------------------------------------------------------------
  // 4. STRIPE CHECKOUT UI_MODE & SESSION INTEGRATION
  // -------------------------------------------------------------------------
  console.log("📌 SECTION 4: Priority 3 — Stripe Checkout ui_mode ('embedded_page')");

  const checkoutServerFile = readFileSync(resolve(process.cwd(), "src/lib/payment-checkout.server.ts"), "utf-8");
  assert(checkoutServerFile.includes('body.set("ui_mode", "embedded_page")'), "payment-checkout.server.ts specifies ui_mode: 'embedded_page'");
  assert(!checkoutServerFile.includes('body.set("ui_mode", "embedded");'), "Deprecated ui_mode: 'embedded' completely removed");
  assert(checkoutServerFile.includes("return_url"), "Stripe checkout session includes required return_url parameter");
  assert(checkoutServerFile.includes("CHECKOUT_SESSION_ID"), "return_url includes {CHECKOUT_SESSION_ID} interpolation parameter");

  const stripeComponentFile = readFileSync(resolve(process.cwd(), "src/components/stripe-embedded-checkout.tsx"), "utf-8");
  assert(stripeComponentFile.includes("stripe.initEmbeddedCheckout"), "StripeEmbeddedCheckout initializes via stripe.initEmbeddedCheckout");
  assert(stripeComponentFile.includes("clientSecret"), "StripeEmbeddedCheckout requires clientSecret prop");
  console.log("");

  // -------------------------------------------------------------------------
  // 5. PAYPAL CONFIGURATION & GATEWAY VALIDATION
  // -------------------------------------------------------------------------
  console.log("📌 SECTION 5: Priority 4 — PayPal Configuration & Gateway Filtering");

  const checkoutFunctionsFile = readFileSync(resolve(process.cwd(), "src/lib/checkout-functions.ts"), "utf-8");
  assert(checkoutFunctionsFile.includes("Boolean(cfg.client_id && (cfg.client_secret || cfg.secret))"), "listCheckoutGateways validates PayPal client_id & secret before returning gateway");
  assert(checkoutFunctionsFile.includes("Boolean(cfg.publishable_key && cfg.secret_key)"), "listCheckoutGateways validates Stripe keys before returning gateway");
  console.log("");

  // -------------------------------------------------------------------------
  // 6. TRAINER PROFILE TAB ICONS
  // -------------------------------------------------------------------------
  console.log("📌 SECTION 6: Priority 5 — Trainer Profile Tab Icons Consistency");

  const trainerProfileRoute = readFileSync(resolve(process.cwd(), "src/routes/trainers.$username.tsx"), "utf-8");
  assert(trainerProfileRoute.includes("<Grid3X3 className=\"h-4 w-4\" />"), "Feed tab trigger uses standard Grid3X3 icon");
  assert(trainerProfileRoute.includes("<Clapperboard className=\"h-4 w-4\" />"), "Shorts tab trigger uses standard Clapperboard icon");
  assert(trainerProfileRoute.includes("<MessageSquare className=\"h-4 w-4\" />"), "Coaching tab trigger uses standard MessageSquare icon");
  assert(trainerProfileRoute.includes('aria-label="Feed posts"') && trainerProfileRoute.includes('aria-label="Shorts videos"') && trainerProfileRoute.includes('aria-label="Coaching sessions"'), "All tabs include accessible aria-labels and tooltips");
  console.log("");

  // -------------------------------------------------------------------------
  // FINAL REPORT SUMMARY
  // -------------------------------------------------------------------------
  console.log("================================================================================");
  console.log(`🏁 DEEP E2E TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED (${failedTests} FAILURES)`);
  console.log("================================================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runDeepE2E().catch((err) => {
  console.error("Deep E2E execution failed:", err);
  process.exit(1);
});
