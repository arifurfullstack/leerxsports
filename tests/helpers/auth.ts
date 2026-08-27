import { Page, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://tdggisdwevfxpitlbeyc.supabase.co";
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZ2dpc2R3ZXZmeHBpdGxiZXljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDc5OTcwMywiZXhwIjoyMTAwMzc1NzAzfQ.YsM4-RoxEjKuAI39E_ioSG5Eg9KWj7Dq1vYgRacnXfQ";
const SUPABASE_ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

// Pure service-role client for DB admin operations
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Dedicated auth client for user credential authentication
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const QA_USERS = {
  trainee: {
    email: process.env.QA_TRAINEE_EMAIL || "qa.trainee@leersports.com",
    password: process.env.QA_TRAINEE_PASSWORD || "LeerSports2026!Trainee",
    displayName: "QA Trainee",
    role: "trainee" as const,
    isVerified: false,
  },
  nonSubscriber: {
    email: process.env.QA_NON_SUBSCRIBER_EMAIL || "qa.nonsubscriber@leersports.com",
    password: process.env.QA_NON_SUBSCRIBER_PASSWORD || "LeerSports2026!NonSub",
    displayName: "QA Non Subscriber",
    role: "trainee" as const,
    isVerified: false,
  },
  subscriber: {
    email: process.env.QA_SUBSCRIBER_EMAIL || "qa.subscriber@leersports.com",
    password: process.env.QA_SUBSCRIBER_PASSWORD || "LeerSports2026!Subscriber",
    displayName: "QA Pro Subscriber",
    role: "trainee" as const,
    isVerified: false,
    isSubscribed: true,
  },
  pendingTrainer: {
    email: process.env.QA_PENDING_TRAINER_EMAIL || "qa.pending.trainer@leersports.com",
    password: process.env.QA_PENDING_TRAINER_PASSWORD || "LeerSports2026!Pending",
    displayName: "QA Pending Trainer",
    role: "trainer" as const,
    isVerified: false,
    appStatus: "pending" as const,
  },
  verifiedTrainer: {
    email: process.env.QA_VERIFIED_TRAINER_EMAIL || "qa.verified.trainer@leersports.com",
    password: process.env.QA_VERIFIED_TRAINER_PASSWORD || "LeerSports2026!Verified",
    displayName: "QA Verified Pro Trainer",
    role: "trainer" as const,
    isVerified: true,
    appStatus: "approved" as const,
  },
  admin: {
    email: process.env.QA_ADMIN_EMAIL || "qa.admin@leersports.com",
    password: process.env.QA_ADMIN_PASSWORD || "LeerSports2026!AdminSec",
    displayName: "QA System Admin",
    role: "admin" as const,
    isVerified: true,
  },
};

const ensuredUsers = new Set<string>();
const sessionCache = new Map<string, any>();

/**
 * Ensures a user account exists with specific credentials and role in Supabase.
 */
export async function ensureQAUser(type: keyof typeof QA_USERS) {
  if (ensuredUsers.has(type)) return;
  ensuredUsers.add(type);

  if (!SUPABASE_SERVICE_KEY) return;
  const config = QA_USERS[type];
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let user = (list?.users ?? []).find((u) => u.email?.toLowerCase() === config.email.toLowerCase());

  if (!user) {
    const { data: c, error } = await supabaseAdmin.auth.admin.createUser({
      email: config.email,
      password: config.password,
      email_confirm: true,
    });
    if (error) console.warn(`Could not create ${config.email}:`, error.message);
    user = c?.user;
  } else {
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: config.password,
      email_confirm: true,
    });
  }

  if (!user) return;

  const username = config.email.split("@")[0].replace(/[^a-z0-9_]/g, "_");

  // Upsert profile
  await supabaseAdmin.from("profiles").upsert(
    {
      user_id: user.id,
      username,
      display_name: config.displayName,
      is_verified: config.isVerified,
      onboarding_completed: true,
    },
    { onConflict: "user_id" },
  );

  // Sync user_roles table
  if (config.role === "admin") {
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: user.id, role: "admin" },
      { onConflict: "user_id, role" },
    );
  } else if (config.role === "trainer") {
    if (type === "verifiedTrainer") {
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: user.id, role: "trainer" },
        { onConflict: "user_id, role" },
      );
      await supabaseAdmin.from("trainer_profiles").upsert(
        {
          user_id: user.id,
          subscription_price: 19.99,
          is_verified: true,
          monetization_enabled: true,
          specialties: ["Strength", "Endurance"],
        },
        { onConflict: "user_id" },
      );
    } else {
      // Pending trainer: keep role or omit until approved, ensure trainer_profile is_verified = false
      await supabaseAdmin.from("trainer_profiles").upsert(
        {
          user_id: user.id,
          subscription_price: 15.0,
          is_verified: false,
          monetization_enabled: false,
        },
        { onConflict: "user_id" },
      );
    }
  } else {
    // Trainee
    await supabaseAdmin.from("user_roles").delete().eq("user_id", user.id).eq("role", "trainer");
    await supabaseAdmin.from("trainer_profiles").update({ is_verified: false }).eq("user_id", user.id);
  }

  // Handle trainer_applications
  if ("appStatus" in config && config.appStatus) {
    await supabaseAdmin.from("trainer_applications").upsert(
      {
        user_id: user.id,
        status: config.appStatus,
        public_trainer_name: config.displayName,
        full_legal_name: `${config.displayName} Legal`,
        requested_price: 19.99,
        country: "US",
        biography: "Professional QA Verified Trainer Bio",
      },
      { onConflict: "user_id" },
    );
  }

  // Handle active subscription for subscriber role
  if ("isSubscribed" in config && config.isSubscribed) {
    const { data: vtList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const vtUser = vtList?.users?.find((u) => u.email?.toLowerCase() === QA_USERS.verifiedTrainer.email.toLowerCase());
    if (vtUser) {
      const { data: existingSub } = await supabaseAdmin
        .from("subscriptions")
        .select("id")
        .eq("subscriber_id", user.id)
        .eq("trainer_id", vtUser.id)
        .maybeSingle();

      if (existingSub) {
        await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "active",
            price: 19.99,
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq("id", existingSub.id);
      } else {
        await supabaseAdmin.from("subscriptions").insert({
          subscriber_id: user.id,
          trainer_id: vtUser.id,
          status: "active",
          price: 19.99,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    }
  }
}

/**
 * Logs in a user via direct Supabase session pre-injection into browser localStorage.
 */
export async function loginAs(page: Page, type: keyof typeof QA_USERS) {
  const creds = QA_USERS[type];
  await ensureQAUser(type);

  let session = sessionCache.get(type);
  if (!session) {
    const { data: authData, error } = await supabaseAuth.auth.signInWithPassword({
      email: creds.email,
      password: creds.password,
    });

    if (error || !authData.session) {
      throw new Error(`Failed to authenticate ${creds.email}: ${error?.message || "No session returned"}`);
    }
    session = authData.session;
    sessionCache.set(type, session);
  }

  const storageKey = `sb-${process.env.VITE_SUPABASE_PROJECT_ID || "tdggisdwevfxpitlbeyc"}-auth-token`;

  // Pre-seed localStorage before any page navigation occurs
  await page.addInitScript(
    ({ key, sessionData }) => {
      window.localStorage.setItem(key, JSON.stringify(sessionData));
    },
    { key: storageKey, sessionData: session },
  );
}

/**
 * Tracks console errors and failed network responses during a test.
 */
export function monitorConsoleAndNetwork(page: Page) {
  const consoleErrors: string[] = [];
  const networkErrors: { url: string; status: number; method: string }[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Filter out expected 3rd party or harmless telemetry noise
      if (!text.includes("favicon") && !text.includes("chrome-extension")) {
        consoleErrors.push(text);
      }
    }
  });

  page.on("response", (resp) => {
    if (resp.status() >= 400) {
      networkErrors.push({
        url: resp.url(),
        status: resp.status(),
        method: resp.request().method(),
      });
    }
  });

  return {
    getConsoleErrors: () => consoleErrors,
    getNetworkErrors: () => networkErrors,
  };
}
