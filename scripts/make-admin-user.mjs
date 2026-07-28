import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://tdggisdwevfxpitlbeyc.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZ2dpc2R3ZXZmeHBpdGxiZXljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDc5OTcwMywiZXhwIjoyMTAwMzc1NzAzfQ.YsM4-RoxEjKuAI39E_ioSG5Eg9KWj7Dq1vYgRacnXfQ";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const adminEmail = "admin@leerdemo.local";
  const password = "Pass123";

  console.log(`Setting up admin user (${adminEmail})...`);

  const { data: usersList, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listError) {
    console.error("Error listing users:", listError);
    process.exit(1);
  }

  let adminUser = usersList?.users?.find(u => u.email?.toLowerCase() === adminEmail.toLowerCase());
  let adminId;

  if (!adminUser) {
    console.log(`Creating user ${adminEmail}...`);
    const { data: c, error: createError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: "Demo Admin", name: "Demo Admin" }
    });
    if (createError) {
      console.error("Error creating admin user:", createError);
      process.exit(1);
    }
    adminId = c?.user?.id;
    console.log(`Created admin user with ID: ${adminId}`);
  } else {
    adminId = adminUser.id;
    console.log(`Found existing admin user with ID: ${adminId}. Updating password...`);
    const { error: updateError } = await supabase.auth.admin.updateUserById(adminId, {
      password: password,
      email_confirm: true,
      user_metadata: { full_name: "Demo Admin", name: "Demo Admin" }
    });
    if (updateError) {
      console.error("Error updating admin user:", updateError);
      process.exit(1);
    }
  }

  if (!adminId) {
    console.error("Could not obtain admin user ID.");
    process.exit(1);
  }

  // 2. Upsert profile
  const { error: profileError } = await supabase.from("profiles").upsert({
    user_id: adminId,
    username: "admin",
    display_name: "Demo Admin",
    full_name: "Demo Admin",
    bio: "Platform Administrator",
    country: "US",
    native_language: "en",
    is_demo: true,
  }, { onConflict: "user_id" });

  if (profileError) {
    console.error("Error upserting profile:", profileError);
  } else {
    console.log("Upserted profile successfully.");
  }

  // 3. Upsert admin role
  const { error: roleError } = await supabase.from("user_roles").upsert([
    { user_id: adminId, role: "admin" },
    { user_id: adminId, role: "user" }
  ], { onConflict: "user_id, role" });

  if (roleError) {
    console.error("Error upserting roles:", roleError);
  } else {
    console.log("Assigned 'admin' role successfully.");
  }

  console.log("\n✅ SUCCESS! Admin user ready:");
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Password: ${password}`);
}

main();
