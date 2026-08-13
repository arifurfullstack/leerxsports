/**
 * apply-coaching-migration.mjs
 * Applies the coaching_status migration directly via Supabase Management API.
 * Usage: node scripts/apply-coaching-migration.mjs --token <access-token>
 */
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = "tdggisdwevfxpitlbeyc";

const tokenArgIdx = process.argv.indexOf("--token");
const ACCESS_TOKEN =
  tokenArgIdx !== -1
    ? process.argv[tokenArgIdx + 1]
    : process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error("Usage: node scripts/apply-coaching-migration.mjs --token <token>");
  console.error("Get token: https://supabase.com/dashboard/account/tokens");
  process.exit(1);
}

const SQL = `
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS coaching_status text
    CHECK (coaching_status IN ('pending', 'coached', 'coaching_completed'))
    DEFAULT NULL;

UPDATE community_posts
  SET coaching_status = 'pending'
  WHERE target_trainer_id IS NOT NULL
    AND coaching_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_community_posts_coaching_status
  ON community_posts(coaching_status)
  WHERE coaching_status IS NOT NULL;
`.trim();

async function run() {
  console.log("▶  Applying coaching_status migration...");
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: SQL }),
    }
  );
  const body = await res.text();
  if (!res.ok) {
    console.error("❌  Failed:", body);
    process.exit(1);
  }
  console.log("✅  coaching_status column added to community_posts");
  console.log("✅  Existing coaching posts set to 'pending'");
}

run().catch(console.error);
