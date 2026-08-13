/**
 * verify-migrations.mjs
 * Checks that the new columns were successfully added.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function checkColumns() {
  const checks = [
    { table: "community_posts",    column: "target_trainer_id" },
    { table: "community_posts",    column: "coaching_status" },
    { table: "community_comments", column: "media_urls" },
    { table: "community_comments", column: "is_private" },
  ];

  console.log("\n🔍  Verifying migration columns...\n");

  for (const { table, column } of checks) {
    // Insert a select that will error if column doesn't exist, succeed if it does
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .limit(1);

    if (error && error.message.includes("does not exist")) {
      console.log(`❌  ${table}.${column} — NOT FOUND`);
    } else if (error) {
      console.log(`⚠️   ${table}.${column} — Error: ${error.message}`);
    } else {
      console.log(`✅  ${table}.${column} — OK`);
    }
  }

  console.log("\nDone.\n");
}

checkColumns().catch(console.error);
