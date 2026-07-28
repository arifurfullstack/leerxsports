import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://tdggisdwevfxpitlbeyc.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZ2dpc2R3ZXZmeHBpdGxiZXljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDc5OTcwMywiZXhwIjoyMTAwMzc1NzAzfQ.YsM4-RoxEjKuAI39E_ioSG5Eg9KWj7Dq1vYgRacnXfQ";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const DEMO_EMAIL_DOMAIN = "leerdemo.local";
const PRIMARY_PASSWORD = "DemoPass123!";

async function fixDemoAccounts() {
  console.log("🛠️ Syncing and fixing passwords for all LEER demo accounts...");

  const { data: usersList, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) {
    console.error("Error listing users:", error);
    process.exit(1);
  }

  const users = usersList?.users || [];
  console.log(`Found ${users.length} total users in Supabase Auth.`);

  // 1. Admin user
  const adminEmail = `admin@${DEMO_EMAIL_DOMAIN}`;
  let adminUser = users.find(u => u.email?.toLowerCase() === adminEmail.toLowerCase());
  let adminId;

  if (!adminUser) {
    console.log(`Creating Admin user (${adminEmail})...`);
    const { data: c, error: cErr } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: PRIMARY_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Demo Admin", name: "Demo Admin" }
    });
    if (cErr) console.error("Admin creation error:", cErr);
    adminId = c?.user?.id;
  } else {
    adminId = adminUser.id;
    console.log(`Updating password for Admin (${adminEmail}) to '${PRIMARY_PASSWORD}'...`);
    const { error: uErr } = await supabase.auth.admin.updateUserById(adminId, {
      password: PRIMARY_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Demo Admin", name: "Demo Admin" }
    });
    if (uErr) console.error("Admin password update error:", uErr);
  }

  if (adminId) {
    await supabase.from("profiles").upsert({
      user_id: adminId,
      username: "admin",
      display_name: "Demo Admin",
      full_name: "Demo Admin",
      bio: "Platform Administrator",
      country: "US",
      native_language: "en",
      is_demo: true,
    }, { onConflict: "user_id" });

    await supabase.from("user_roles").upsert([
      { user_id: adminId, role: "admin" },
      { user_id: adminId, role: "user" }
    ], { onConflict: "user_id, role" });
  }

  // 2. Provision/update passwords for all other leerdemo.local users
  const demoUsers = users.filter(u => u.email?.endsWith(`@${DEMO_EMAIL_DOMAIN}`));
  for (const u of demoUsers) {
    console.log(`Setting password for ${u.email} -> '${PRIMARY_PASSWORD}'...`);
    await supabase.auth.admin.updateUserById(u.id, {
      password: PRIMARY_PASSWORD,
      email_confirm: true
    });
  }

  console.log("\n✅ ALL DEMO ACCOUNTS UPDATED SUCCESSFULLY!");
  console.log(`   Shared Password: ${PRIMARY_PASSWORD}`);
}

fixDemoAccounts();
