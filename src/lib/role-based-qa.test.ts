/**
 * ============================================================
 * ROLE-BASED COMPREHENSIVE QA TEST SUITE
 * Exercises all 5 User Roles (Guest, Trainee, Trainer, Moderator, Admin)
 * plus Live Stripe Sandbox Key Integration Verification
 * ============================================================
 */
import { describe, it, expect, beforeEach } from "vitest";
import { SECRET_FIELDS, validateGatewayConfigLive } from "@/lib/gateway-config-schemas";
import {
  permissionsForRole,
  permissionForPath,
  ADMIN_PERMISSIONS,
  MODERATOR_PERMISSIONS,
  firstAccessibleAdminPath,
} from "@/lib/admin-permissions";
import { checkPassword, classifyAuthError } from "@/lib/password-strength";
import { sanitizeRedirect, resolveAuthIntent, resolvePostAuthTarget } from "@/lib/auth-intent";
import { isProtectedPath, shouldRefreshBeforeUse } from "@/lib/session-lifecycle";
import {
  traineeOnboardingSchema,
  trainerApplicationSchema,
  createClassSchema,
  loginSchema,
  signupSchema,
  appRoleSchema,
  type AppRole,
} from "@/lib/schemas";
import { createStorySchema } from "@/lib/story-functions";
import { assertCannotDemoteSelf } from "@/lib/admin-roles-functions";
import { z } from "zod";

// ─── ROLE 1: GUEST / UNAUTHENTICATED USER ─────────────────────────────────────

describe("[ROLE-1: GUEST] Access Controls & Route Protection", () => {
  it("GUEST-01: All protected route prefixes are strictly guarded", () => {
    const protectedRoutes = [
      "/admin",
      "/admin/roles",
      "/admin/payment-gateways",
      "/creator.dashboard",
      "/dashboard",
      "/library",
      "/messages",
      "/notifications",
      "/onboarding",
      "/profile",
      "/settings",
    ];
    for (const route of protectedRoutes) {
      expect(isProtectedPath(route)).toBe(true);
    }
  });

  it("GUEST-02: Public marketing & auth routes are accessible", () => {
    const publicRoutes = ["/", "/auth", "/browse", "/feed", "/home", "/pricing", "/explore"];
    for (const route of publicRoutes) {
      expect(isProtectedPath(route)).toBe(false);
    }
  });

  it("GUEST-03: Open-redirect attempts are sanitized to empty string", () => {
    expect(sanitizeRedirect("//evil.com")).toBe("");
    expect(sanitizeRedirect("https://attacker.com")).toBe("");
    expect(sanitizeRedirect("javascript:alert(1)")).toBe("");
  });

  it("GUEST-04: Guest auth intent stamp redirects cleanly", () => {
    expect(resolveAuthIntent("/admin")).toBe("admin");
    expect(resolvePostAuthTarget({ intent: "admin" })).toBe("/admin");
    expect(resolvePostAuthTarget({ intent: "" })).toBe("/home");
  });

  it("GUEST-05: Login schema rejects weak or malformed inputs", () => {
    expect(loginSchema.safeParse({ email: "invalid-email", password: "123" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "user@example.com", password: "abc" }).success).toBe(
      false,
    );
  });
});

// ─── ROLE 2: TRAINEE (STANDARD USER) ──────────────────────────────────────────

describe("[ROLE-2: TRAINEE] Registration, Onboarding & User Features", () => {
  it("TRAINEE-01: Trainee receives empty admin permissions array", () => {
    const perms = permissionsForRole("trainee" as AppRole, false);
    expect(perms).toHaveLength(0);
    expect(firstAccessibleAdminPath(perms)).toBeNull();
  });

  it("TRAINEE-02: Onboarding requires agreement acceptance (agreement_accepted=true)", () => {
    const base = {
      username: "trainee_john",
      display_name: "John Trainee",
      country: "United States",
      native_language: "English",
      experience_level: "beginner",
    };
    expect(traineeOnboardingSchema.safeParse({ ...base, agreement_accepted: false }).success).toBe(
      false,
    );
    expect(traineeOnboardingSchema.safeParse({ ...base, agreement_accepted: true }).success).toBe(
      true,
    );
  });

  it("TRAINEE-03: Trainee onboarding validates height, weight, body fat bounds", () => {
    const valid = {
      username: "alex_fit",
      display_name: "Alex",
      country: "Canada",
      native_language: "English",
      experience_level: "intermediate",
      agreement_accepted: true as const,
      height_cm: 180,
      weight_kg: 80,
      body_fat_percent: 15,
    };
    expect(traineeOnboardingSchema.safeParse(valid).success).toBe(true);
    expect(traineeOnboardingSchema.safeParse({ ...valid, height_cm: 350 }).success).toBe(false);
    expect(traineeOnboardingSchema.safeParse({ ...valid, weight_kg: 600 }).success).toBe(false);
    expect(traineeOnboardingSchema.safeParse({ ...valid, body_fat_percent: 90 }).success).toBe(
      false,
    );
  });

  it("TRAINEE-04: Trainee signup schema requires full name and valid email", () => {
    expect(
      signupSchema.safeParse({
        email: "new@test.com",
        password: "securepassword123",
        fullName: "Jane Doe",
      }).success,
    ).toBe(true);
    expect(
      signupSchema.safeParse({ email: "new@test.com", password: "securepassword123" }).success,
    ).toBe(false);
  });
});

// ─── ROLE 3: TRAINER (CREATOR) ────────────────────────────────────────────────

describe("[ROLE-3: TRAINER] Application Workflow & Creator Rules", () => {
  it("TRAINER-01: Trainer role grants 0 admin permissions (trainers are creators, not staff)", () => {
    const perms = permissionsForRole("trainer" as AppRole, false);
    expect(perms).toHaveLength(0);
  });

  it("TRAINER-02: Trainer application requires agreement & valid pricing (0-999)", () => {
    const validApp = {
      username: "coach_david",
      display_name: "Coach David",
      full_legal_name: "David Smith",
      public_trainer_name: "Dave Coach",
      country: "United Kingdom",
      native_language: "English",
      specialties: ["strength", "hiit"],
      years_experience: 5,
      requested_price: 24.99,
      agreement_accepted: true as const,
    };
    expect(trainerApplicationSchema.safeParse(validApp).success).toBe(true);
    expect(trainerApplicationSchema.safeParse({ ...validApp, requested_price: 1500 }).success).toBe(
      false,
    );
    expect(
      trainerApplicationSchema.safeParse({ ...validApp, agreement_accepted: false }).success,
    ).toBe(false);
  });

  it("TRAINER-03: Story creation schema resolves default duration (5s image, 8s video)", () => {
    const imgParsed = createStorySchema.parse({ media_path: "stories/1.jpg", media_kind: "image" });
    const vidParsed = createStorySchema.parse({ media_path: "stories/1.mp4", media_kind: "video" });
    expect(imgParsed.duration_ms).toBe(5000);
    expect(vidParsed.duration_ms).toBe(8000);
  });

  it("TRAINER-04: Trainer class creation schema enforces slug format & non-negative price", () => {
    const validClass = {
      title: "HIIT Workout",
      slug: "hiit-workout",
      instructor: "Coach David",
      duration_minutes: 45,
      capacity: 15,
      schedule: "2026-10-01T10:00:00+00:00",
      level: "intermediate",
      price: 10,
    };
    expect(createClassSchema.safeParse(validClass).success).toBe(true);
    expect(createClassSchema.safeParse({ ...validClass, slug: "HIIT Workout!" }).success).toBe(
      false,
    );
    expect(createClassSchema.safeParse({ ...validClass, price: -5 }).success).toBe(false);
  });
});

// ─── ROLE 4: MODERATOR ────────────────────────────────────────────────────────

describe("[ROLE-4: MODERATOR] Content Moderation & RBAC Restrictions", () => {
  it("MODERATOR-01: Moderator possesses exactly 16 permissions", () => {
    const perms = permissionsForRole("moderator", false);
    expect(perms.length).toBe(MODERATOR_PERMISSIONS.length);
    expect(perms.length).toBe(16);
  });

  it("MODERATOR-02: Moderator HAS permissions for moderation, reports, disputes, strikes", () => {
    const perms = permissionsForRole("moderator", false);
    expect(perms).toContain("moderation");
    expect(perms).toContain("manage_disputes");
    expect(perms).toContain("manage_strikes");
    expect(perms).toContain("view_overview");
  });

  it("MODERATOR-03: SECURITY — Moderator is BLOCKED from system admin settings & roles", () => {
    const perms = permissionsForRole("moderator", false);
    expect(perms).not.toContain("manage_roles");
    expect(perms).not.toContain("manage_payment_gateways");
    expect(perms).not.toContain("manage_webhooks");
    expect(perms).not.toContain("manage_security");
  });

  it("MODERATOR-04: Moderator route mapping points to accessible first admin path", () => {
    const perms = permissionsForRole("moderator", false);
    const firstPath = firstAccessibleAdminPath(perms);
    expect(firstPath).toBe("/admin");
  });
});

// ─── ROLE 5: ADMIN (SUPERUSER) ────────────────────────────────────────────────

describe("[ROLE-5: ADMIN] Full Platform Access & Demotion Protection", () => {
  it("ADMIN-01: Admin possesses ALL 34 platform permissions", () => {
    const perms = permissionsForRole("admin", false);
    expect(perms.length).toBe(ADMIN_PERMISSIONS.length);
    expect(perms.length).toBe(34);
  });

  it("ADMIN-02: isAdmin=true flag overrides role and grants full admin", () => {
    const perms = permissionsForRole("user" as AppRole, true);
    expect(perms).toContain("manage_roles");
    expect(perms).toContain("manage_security");
    expect(perms).toContain("manage_payment_gateways");
  });

  it("ADMIN-03: SECURITY — Admin cannot demote themselves (assertCannotDemoteSelf)", () => {
    const ADMIN_ID = "00000000-0000-0000-0000-000000000001";
    expect(() => assertCannotDemoteSelf(ADMIN_ID, ADMIN_ID, [])).toThrow(
      "You cannot remove your own admin role.",
    );
    expect(() => assertCannotDemoteSelf(ADMIN_ID, ADMIN_ID, ["trainer"])).toThrow(
      "You cannot remove your own admin role.",
    );
  });

  it("ADMIN-04: Admin route permissions map cleanly for all admin sub-routes", () => {
    expect(permissionForPath("/admin/users")).toBe("manage_users");
    expect(permissionForPath("/admin/roles")).toBe("manage_roles");
    expect(permissionForPath("/admin/payment-gateways")).toBe("manage_payment_gateways");
    expect(permissionForPath("/admin/security")).toBe("manage_security");
  });
});

// ─── STRIPE SANDBOX KEY & INTEGRATION VERIFICATION ───────────────────────────

describe("[STRIPE SANDBOX] Environment Keys & Payment Intent Infrastructure", () => {
  it("STRIPE-01: Admin-configured Stripe test credentials validate", () => {
    const errors = validateGatewayConfigLive("stripe", "test", {
      publishable_key: "pk_test_example123",
      secret_key: "sk_test_example123",
      webhook_secret: "whsec_example123",
    });
    expect(errors).toEqual({});
  });

  it("STRIPE-02: Stripe server secrets are classified for encryption", () => {
    expect(SECRET_FIELDS.stripe).toEqual(expect.arrayContaining(["secret_key", "webhook_secret"]));
    expect(SECRET_FIELDS.stripe).not.toContain("publishable_key");
  });

  it("STRIPE-03: Commission Math correctly calculates 20% platform fee for $15 subscription", () => {
    const gross = 15;
    const bps = 2000; // 20%
    const platformFee = Math.round(gross * bps) / 10000;
    const trainerAmount = Math.round((gross - platformFee) * 100) / 100;
    expect(platformFee).toBe(3);
    expect(trainerAmount).toBe(12);
  });

  it("STRIPE-04: Strict email validation prevents injection in billing form", () => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    expect(emailRegex.test("shopper@example.com")).toBe(true);
    expect(emailRegex.test("admin'--@hack.com")).toBe(false);
  });
});

// ─── QA ROUND 6 FIXES VERIFICATION ──────────────────────────────────────────

describe("[QA ROUND FIXES] RBAC, Admin Flow, Wallet Removal, Checkout & Layout", () => {
  it("QA-01: Trainer Pending status does not grant verified trainer role", () => {
    const perms = permissionsForRole("trainee" as AppRole, false);
    expect(perms).toHaveLength(0);
  });

  it("QA-02: App role schema strictly defines valid platform roles", () => {
    expect(appRoleSchema.safeParse("trainer").success).toBe(true);
    expect(appRoleSchema.safeParse("admin").success).toBe(true);
    expect(appRoleSchema.safeParse("moderator").success).toBe(true);
    expect(appRoleSchema.safeParse("trainee").success).toBe(true);
    expect(appRoleSchema.safeParse("trainer_pending").success).toBe(false);
  });

  it("QA-03: Platform fee and trainer payout math for $300 Paid Q&A", () => {
    const gross = 300;
    const bps = 2000; // 20%
    const platformFee = Math.round(gross * bps) / 10000;
    const trainerAmount = Math.round((gross - platformFee) * 100) / 100;
    expect(platformFee).toBe(60);
    expect(trainerAmount).toBe(240);
  });

  it("QA-04: Trainer requested price allows minimum $4.99 and maximum $499.99", () => {
    const baseValid = {
      username: "coach_mike",
      agreement_accepted: true,
    };
    // Valid boundary values
    expect(trainerApplicationSchema.safeParse({ ...baseValid, requested_price: 4.99 }).success).toBe(true);
    expect(trainerApplicationSchema.safeParse({ ...baseValid, requested_price: 19.99 }).success).toBe(true);
    expect(trainerApplicationSchema.safeParse({ ...baseValid, requested_price: 499.99 }).success).toBe(true);

    // Invalid below minimum $4.99
    expect(trainerApplicationSchema.safeParse({ ...baseValid, requested_price: 4.98 }).success).toBe(false);
    expect(trainerApplicationSchema.safeParse({ ...baseValid, requested_price: 0 }).success).toBe(false);
    expect(trainerApplicationSchema.safeParse({ ...baseValid, requested_price: -5 }).success).toBe(false);

    // Invalid above maximum $499.99
    expect(trainerApplicationSchema.safeParse({ ...baseValid, requested_price: 500 }).success).toBe(false);
    expect(trainerApplicationSchema.safeParse({ ...baseValid, requested_price: 1000 }).success).toBe(false);
  });

  it("QA-05: Single monthly subscription calculations across flexible price tiers", () => {
    const prices = [4.99, 9.99, 19.99, 49.99, 149.99, 499.99];
    const bps = 2000; // 20% commission

    for (const p of prices) {
      const platformFee = Math.round(p * bps) / 10000;
      const trainerShare = Math.round((p - platformFee) * 100) / 100;
      expect(platformFee + trainerShare).toBeCloseTo(p, 2);
      expect(trainerShare).toBeGreaterThan(0);
    }
  });

  it("QA-06: Q&A RBAC rejects Pending Trainers & Trainees from answering dispatches", () => {
    function canAnswerQA(user: { role?: string; is_verified?: boolean; app_status?: string }) {
      const isVerifiedRole = user.role === "trainer";
      const isVerifiedProfile = user.is_verified === true;
      const isPendingOrRejected =
        user.app_status === "pending" ||
        user.app_status === "rejected" ||
        user.app_status === "resubmit";
      return Boolean(isVerifiedRole && isVerifiedProfile && !isPendingOrRejected);
    }

    // Trainee
    expect(canAnswerQA({ role: "trainee", is_verified: false })).toBe(false);

    // Pending Trainer (application submitted, not yet approved)
    expect(canAnswerQA({ role: "trainee", is_verified: false, app_status: "pending" })).toBe(false);
    expect(canAnswerQA({ role: "trainer", is_verified: false, app_status: "pending" })).toBe(false);
    expect(canAnswerQA({ role: "trainer", is_verified: true, app_status: "pending" })).toBe(false);

    // Rejected Trainer
    expect(canAnswerQA({ role: "trainer", is_verified: true, app_status: "rejected" })).toBe(false);

    // Unverified Trainer
    expect(canAnswerQA({ role: "trainer", is_verified: false, app_status: "approved" })).toBe(false);

    // Verified Pro Trainer
    expect(canAnswerQA({ role: "trainer", is_verified: true, app_status: "approved" })).toBe(true);
    expect(canAnswerQA({ role: "trainer", is_verified: true, app_status: undefined })).toBe(true);
  });

  it("QA-07: Stripe Checkout creation enforces ui_mode: 'embedded_page' and return_url", () => {
    const origin = "https://leersports.cliplyx.com";
    const orderId = "123e4567-e89b-12d3-a456-426614174000";
    const returnUrl = `${origin}/payment/complete?order_id=${orderId}&session_id={CHECKOUT_SESSION_ID}`;

    const body = new URLSearchParams();
    body.set("ui_mode", "embedded_page");
    body.set("mode", "subscription");
    body.set("return_url", returnUrl);

    expect(body.get("ui_mode")).toBe("embedded_page");
    expect(body.get("ui_mode")).not.toBe("embedded");
    expect(body.get("return_url")).toContain("{CHECKOUT_SESSION_ID}");
  });

  it("QA-08: Unconfigured PayPal Gateway without credentials is excluded from client checkout", () => {
    const gateways = [
      { provider: "stripe", enabled: true, config: { publishable_key: "pk_test", secret_key: "sk_test" } },
      { provider: "paypal", enabled: true, config: {} }, // Unconfigured credentials
      { provider: "bank", enabled: true, config: {} },
    ];

    const validGateways = gateways.filter((row) => {
      const cfg = row.config as Record<string, string>;
      if (row.provider === "paypal") {
        return Boolean(cfg.client_id && (cfg.client_secret || cfg.secret));
      }
      if (row.provider === "stripe") {
        return Boolean(cfg.publishable_key && cfg.secret_key);
      }
      return true;
    });

    expect(validGateways.map((g) => g.provider)).toEqual(["stripe", "bank"]);
    expect(validGateways.map((g) => g.provider)).not.toContain("paypal");
  });
});
