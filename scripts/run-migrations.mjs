/**
 * run-migrations.mjs
 * Runs pending SQL migration files directly against Supabase via the REST API
 * using the service role key (no CLI login required).
 *
 * Usage: node scripts/run-migrations.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Run a single SQL statement via rpc ───────────────────────────────────────
async function runSql(sql) {
  const { error } = await supabase.rpc("exec_sql", { sql });
  if (error) throw error;
}

// ── Fallback: use the Postgres REST endpoint directly ─────────────────────────
async function runSqlViaRest(sql) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

// Pick only the migrations we need to run (the two new ones)
const TARGET_MIGRATIONS = [
  "20260729160000_add_target_trainer_id_to_community_posts.sql",
  "20260813070000_add_media_to_community_comments.sql",
];

async function main() {
  console.log("🔄  Running migrations via Supabase service role...\n");

  for (const filename of TARGET_MIGRATIONS) {
    const filepath = join(MIGRATIONS_DIR, filename);
    let sql;
    try {
      sql = readFileSync(filepath, "utf8");
    } catch {
      console.warn(`⚠️   ${filename} not found — skipping`);
      continue;
    }

    console.log(`▶   ${filename}`);
    try {
      // Try the pg_execute approach via a direct REST call to pg
      const pgUrl = `${SUPABASE_URL}/rest/v1/`;
      
      // Use supabase-js to run raw SQL via service role
      // This works through the "pg" endpoint if available, or we craft it manually
      const response = await fetch(`${SUPABASE_URL.replace("supabase.co", "supabase.co")}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ sql }),
      });

      if (!response.ok) {
        // Try alternative: use the pg endpoint
        const pgRes = await fetch(`${SUPABASE_URL}/pg/query`, {
          method: "POST",
          headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: sql }),
        });

        if (!pgRes.ok) {
          const body = await pgRes.text();
          console.error(`❌  Failed: ${body}`);
          continue;
        }
      }

      console.log(`✅  Done: ${filename}\n`);
    } catch (err) {
      console.error(`❌  Error running ${filename}:`, err.message);
    }
  }

  console.log("✅  All migrations attempted.");
  console.log("\nNote: IF the exec_sql RPC doesn't exist in your project,");
  console.log("run the SQL manually via the Supabase Dashboard SQL editor:");
  console.log(`  https://supabase.com/dashboard/project/tdggisdwevfxpitlbeyc/sql/new\n`);
}

main().catch(console.error);
