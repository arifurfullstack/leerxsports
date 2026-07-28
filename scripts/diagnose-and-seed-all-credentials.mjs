import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://tdggisdwevfxpitlbeyc.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZ2dpc2R3ZXZmeHBpdGxiZXljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDc5OTcwMywiZXhwIjoyMTAwMzc1NzAzfQ.YsM4-RoxEjKuAI39E_ioSG5Eg9KWj7Dq1vYgRacnXfQ";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const DEMO_EMAIL_DOMAIN = "leerdemo.local";
const PRIMARY_PASSWORD = "DemoPass123!";

async function diagnoseAndFix() {
  console.log("🔍 Diagnosing all users in Supabase Auth...");

  const { data: usersList, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) {
    console.error("Error listing users:", error);
    process.exit(1);
  }

  const existingUsers = usersList?.users || [];
  console.log(`Currently found ${existingUsers.length} users in Auth:`);
  for (const u of existingUsers) {
    console.log(`  - ${u.email} (ID: ${u.id})`);
  }

  // Define exact email aliases to guarantee 100% login success for any variation typed by user:
  const accountsToCreateOrUpdate = [
    // ADMIN
    { email: `admin@${DEMO_EMAIL_DOMAIN}`, username: "admin", displayName: "Demo Admin", role: "admin" },
    { email: `admin@leer.local`, username: "admin", displayName: "Demo Admin", role: "admin" },

    // CREATORS / TRAINERS (Both underscore and hyphen formats!)
    { email: `coach-nova@${DEMO_EMAIL_DOMAIN}`, username: "coach_nova", displayName: "Coach Nova", role: "trainer" },
    { email: `coach_nova@${DEMO_EMAIL_DOMAIN}`, username: "coach_nova", displayName: "Coach Nova", role: "trainer" },
    { email: `coach-ronin@${DEMO_EMAIL_DOMAIN}`, username: "coach_ronin", displayName: "Coach Ronin", role: "trainer" },
    { email: `coach_ronin@${DEMO_EMAIL_DOMAIN}`, username: "coach_ronin", displayName: "Coach Ronin", role: "trainer" },
    { email: `coach-vega@${DEMO_EMAIL_DOMAIN}`, username: "coach_vega", displayName: "Coach Vega", role: "trainer" },
    { email: `coach_vega@${DEMO_EMAIL_DOMAIN}`, username: "coach_vega", displayName: "Coach Vega", role: "trainer" },
    { email: `coach-lyra@${DEMO_EMAIL_DOMAIN}`, username: "coach_lyra", displayName: "Coach Lyra", role: "trainer" },
    { email: `coach_lyra@${DEMO_EMAIL_DOMAIN}`, username: "coach_lyra", displayName: "Coach Lyra", role: "trainer" },
    { email: `coach-aris@${DEMO_EMAIL_DOMAIN}`, username: "coach_aris", displayName: "Coach Aris", role: "trainer" },
    { email: `coach_aris@${DEMO_EMAIL_DOMAIN}`, username: "coach_aris", displayName: "Coach Aris", role: "trainer" },
    { email: `coach-mara@${DEMO_EMAIL_DOMAIN}`, username: "coach_mara", displayName: "Coach Mara", role: "trainer" },
    { email: `coach_mara@${DEMO_EMAIL_DOMAIN}`, username: "coach_mara", displayName: "Coach Mara", role: "trainer" },
    { email: `coach-kova@${DEMO_EMAIL_DOMAIN}`, username: "coach_kova", displayName: "Coach Kova", role: "trainer" },
    { email: `coach_kova@${DEMO_EMAIL_DOMAIN}`, username: "coach_kova", displayName: "Coach Kova", role: "trainer" },
    { email: `coach-nyx@${DEMO_EMAIL_DOMAIN}`, username: "coach_nyx", displayName: "Coach Nyx", role: "trainer" },
    { email: `coach_nyx@${DEMO_EMAIL_DOMAIN}`, username: "coach_nyx", displayName: "Coach Nyx", role: "trainer" },

    // ATHLETES / TRAINEES
    { email: `athlete_kai@${DEMO_EMAIL_DOMAIN}`, username: "athlete_kai", displayName: "Kai", role: "trainee" },
    { email: `athlete-kai@${DEMO_EMAIL_DOMAIN}`, username: "athlete_kai", displayName: "Kai", role: "trainee" },
    { email: `sam_lifts@${DEMO_EMAIL_DOMAIN}`, username: "sam_lifts", displayName: "Sam", role: "trainee" },
    { email: `sam-lifts@${DEMO_EMAIL_DOMAIN}`, username: "sam_lifts", displayName: "Sam", role: "trainee" },
    { email: `mia_moves@${DEMO_EMAIL_DOMAIN}`, username: "mia_moves", displayName: "Mia", role: "trainee" },
    { email: `mia-moves@${DEMO_EMAIL_DOMAIN}`, username: "mia_moves", displayName: "Mia", role: "trainee" },
    { email: `yuki_swims@${DEMO_EMAIL_DOMAIN}`, username: "yuki_swims", displayName: "Yuki", role: "trainee" },
    { email: `yuki-swims@${DEMO_EMAIL_DOMAIN}`, username: "yuki_swims", displayName: "Yuki", role: "trainee" },
    { email: `priya_yoga@${DEMO_EMAIL_DOMAIN}`, username: "priya_yoga", displayName: "Priya", role: "trainee" },
    { email: `priya-yoga@${DEMO_EMAIL_DOMAIN}`, username: "priya_yoga", displayName: "Priya", role: "trainee" },
    { email: `noor_fat_loss@${DEMO_EMAIL_DOMAIN}`, username: "noor_fat_loss", displayName: "Noor", role: "trainee" },
    { email: `noor-fat-loss@${DEMO_EMAIL_DOMAIN}`, username: "noor_fat_loss", displayName: "Noor", role: "trainee" },
  ];

  console.log("\n⚡ Provisioning & Syncing exact Auth users with password 'DemoPass123!'...");

  for (const acc of accountsToCreateOrUpdate) {
    const existing = existingUsers.find(u => u.email?.toLowerCase() === acc.email.toLowerCase());
    let userId;

    if (existing) {
      userId = existing.id;
      const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
        password: PRIMARY_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: acc.displayName, name: acc.displayName }
      });
      if (updErr) {
        console.error(`Failed to update ${acc.email}:`, updErr.message);
      } else {
        console.log(`✅ Updated password to '${PRIMARY_PASSWORD}' for: ${acc.email}`);
      }
    } else {
      const { data: c, error: cErr } = await supabase.auth.admin.createUser({
        email: acc.email,
        password: PRIMARY_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: acc.displayName, name: acc.displayName }
      });
      if (cErr) {
        console.error(`Failed to create ${acc.email}:`, cErr.message);
        continue;
      }
      userId = c.user.id;
      console.log(`✨ Created user: ${acc.email} (ID: ${userId})`);
    }

    // Upsert Profile
    await supabase.from("profiles").upsert({
      user_id: userId,
      username: acc.username,
      display_name: acc.displayName,
      full_name: acc.displayName,
      country: "US",
      native_language: "en",
      is_demo: true,
    }, { onConflict: "user_id" });

    // Upsert Role
    if (acc.role === "admin") {
      await supabase.from("user_roles").upsert([
        { user_id: userId, role: "admin" },
        { user_id: userId, role: "user" }
      ], { onConflict: "user_id, role" });
    } else if (acc.role === "trainer") {
      await supabase.from("user_roles").upsert([
        { user_id: userId, role: "trainer" },
        { user_id: userId, role: "user" }
      ], { onConflict: "user_id, role" });

      await supabase.from("trainer_profiles").upsert({
        user_id: userId,
        status: "approved",
        subscription_price: 19.99,
        monetization_enabled: true,
        dms_enabled: true,
      }, { onConflict: "user_id" });
    }
  }

  // Double check login authentication for admin and coach-nova right now via client test
  console.log("\n🧪 Verifying Auth Client Login Test...");
  const testClient = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZ2dpc2R3ZXZmeHBpdGxiZXljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3OTk3MDMsImV4cCI6MjEwMDM3NTcwM30.6iX0P_eZ2W8Z902nO74mU6oO3g18YV-hL7P999_8888");

  const testEmails = ["admin@leerdemo.local", "coach-nova@leerdemo.local", "coach_nova@leerdemo.local", "athlete_kai@leerdemo.local"];
  for (const email of testEmails) {
    const { data: signInData, error: signInErr } = await testClient.auth.signInWithPassword({
      email,
      password: PRIMARY_PASSWORD,
    });
    if (signInErr) {
      console.error(`❌ Login test FAILED for ${email}:`, signInErr.message);
    } else {
      console.log(`🎉 Login test SUCCESS for ${email}! (User ID: ${signInData.user.id})`);
    }
  }

  console.log("\n💯 PROVISIONING COMPLETE!");
}

diagnoseAndFix();
