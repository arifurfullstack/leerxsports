/**
 * apply-migrations.mjs
 * 
 * Runs the two pending migrations directly against the Supabase project
 * using the Supabase Management API (no CLI login needed).
 * 
 * Usage:
 *   node scripts/apply-migrations.mjs --token <your-supabase-access-token>
 * 
 * Get your access token from: https://supabase.com/dashboard/account/tokens
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── Config ────────────────────────────────────────────────────────────────────
const PROJECT_REF = "tdggisdwevfxpitlbeyc";

// Read token from --token arg or SUPABASE_ACCESS_TOKEN env
const tokenArgIdx = process.argv.indexOf("--token");
const ACCESS_TOKEN =
  tokenArgIdx !== -1
    ? process.argv[tokenArgIdx + 1]
    : process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error(`
❌  No access token provided.

Get yours from: https://supabase.com/dashboard/account/tokens
Then run:
  node scripts/apply-migrations.mjs --token <paste-token-here>
`);
  process.exit(1);
}

// ── The two pending migration SQLs ───────────────────────────────────────────
const MIGRATIONS = [
  {
    name: "20260729160000 — Add target_trainer_id to community_posts",
    sql: `
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS target_trainer_id uuid REFERENCES profiles(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_community_posts_target_trainer_id
  ON community_posts(target_trainer_id);
    `.trim(),
  },
  {
    name: "20260813070000 — Add media_urls and is_private to community_comments",
    sql: `
ALTER TABLE community_comments
  ADD COLUMN IF NOT EXISTS media_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_community_comments_is_private
  ON community_comments(is_private);
    `.trim(),
  },
];

// ── Run SQL via Supabase Management API ─────────────────────────────────────
async function runSql(sql, name) {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return body;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🔗  Project: ${PROJECT_REF}`);
  console.log(`🔑  Token:   ${ACCESS_TOKEN.slice(0, 12)}...\n`);

  for (const { name, sql } of MIGRATIONS) {
    process.stdout.write(`▶  ${name} ... `);
    try {
      await runSql(sql, name);
      console.log("✅  Done");
    } catch (err) {
      console.log("❌  Failed");
      console.error(`   ${err.message}\n`);
    }
  }

  console.log("\n✅  All migrations applied!");
  console.log("   Verify at: https://supabase.com/dashboard/project/tdggisdwevfxpitlbeyc/editor");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
