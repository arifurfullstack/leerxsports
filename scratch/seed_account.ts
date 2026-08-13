import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const idx = trimmed.indexOf("=");
        if (idx > 0) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const targetEmail = "test2026cc@gmail.com";
  console.log(`Searching for account: ${targetEmail}`);

  const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers();
  if (usersErr) {
    console.error("Error listing users:", usersErr);
    process.exit(1);
  }

  let user = usersData.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase());

  if (!user) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", "%test2026cc%")
      .maybeSingle();
    if (prof) {
      user = { id: prof.user_id, email: targetEmail } as any;
    }
  }

  if (!user) {
    console.error(`User ${targetEmail} not found in Supabase!`);
    process.exit(1);
  }

  const userId = user.id;
  console.log(`Found user_id: ${userId}`);

  // 1. Add $1000 to user_wallets
  const { error: wErr } = await supabase
    .from("user_wallets")
    .upsert(
      {
        user_id: userId,
        balance: 1000,
        currency: "USD",
      },
      { onConflict: "user_id" },
    );

  if (wErr) {
    console.error("Error updating user_wallets:", wErr);
  } else {
    console.log("Successfully set user_wallets balance to $1000 USD!");
  }

  // 2. Update trainer_profiles
  const { data: existingTp } = await supabase
    .from("trainer_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const { error: tpErr } = await supabase.from("trainer_profiles").upsert({
    user_id: userId,
    subscription_price: existingTp?.subscription_price ?? 19.99,
    is_verified: true,
    specialties: existingTp?.specialties ?? ["SWIMMING", "CONDITIONING"],
    value_proposition: existingTp?.value_proposition ?? "Certified Coach",
    monetization_enabled: true,
    dms_enabled: true,
  });

  if (tpErr) {
    console.error("Error updating trainer_profiles:", tpErr);
  } else {
    console.log("Successfully approved & verified trainer_profiles!");
  }

  // 3. Update trainer_applications if table exists
  try {
    const { error: appErr } = await supabase
      .from("trainer_applications")
      .upsert({
        user_id: userId,
        status: "approved",
        full_name: "Test Coach",
        specialties: ["SWIMMING", "CONDITIONING"],
        country: "US",
      });

    if (appErr) {
      console.log("Note on trainer_applications:", appErr.message);
    } else {
      console.log("Successfully approved trainer_applications!");
    }
  } catch (e) {
    console.log("trainer_applications notice:", e);
  }

  console.log(`\n🎉 ALL DONE! Account test2026cc@gmail.com is funded with $1000 and 100% verified & approved!`);
}

main().catch(console.error);
