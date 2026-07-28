#!/usr/bin/env node
/**
 * Integration test: a fresh signup can log in immediately with no
 * verification-token exchange (auto-confirm on, no /verify-email hop).
 *
 * Assertions:
 *   1. supabase.auth.signUp returns a session AND an email_confirmed_at
 *      timestamp — i.e. the account is confirmed on creation, no token
 *      link needed.
 *   2. supabase.auth.signInWithPassword succeeds on the very same
 *      credentials with no intermediate verification step.
 *   3. No references to /verify-email exist in the shipped client code.
 *
 * Usage:
 *   node scripts/signup-immediate-login.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!URL || !KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY in env");
  process.exit(1);
}

function assert(cond, msg) {
  if (!cond) {
    console.error("✗", msg);
    process.exit(1);
  }
  console.log("✓", msg);
}

// --- 1 & 2: real signup -> immediate login roundtrip ---------------------
const email = `signup-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@leerdemo.local`;
const password = "ImmediateLogin123!";

const supabase = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
  email,
  password,
  options: { data: { full_name: "Signup Immediate Test" } },
});
assert(!signUpErr, `signUp succeeds (${signUpErr?.message ?? "ok"})`);
assert(signUp?.user, "signUp returns a user");
assert(
  !!signUp?.user?.email_confirmed_at,
  "user.email_confirmed_at is set immediately (no verification required)",
);
assert(
  !!signUp?.session?.access_token,
  "signUp returns an active session (auto sign-in)",
);

// Fresh client with no residual session to prove login works standalone.
const clean = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: signIn, error: signInErr } = await clean.auth.signInWithPassword({
  email,
  password,
});
assert(!signInErr, `signInWithPassword succeeds without verification (${signInErr?.message ?? "ok"})`);
assert(!!signIn?.session?.access_token, "sign-in returns an access token");
assert(signIn?.user?.email === email, "sign-in returns the same user");

// --- 3: no residual /verify-email or verifyOtp handling in client code ---
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "routeTree.gen.ts") continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk("src");
const offenders = [];
for (const f of files) {
  const t = readFileSync(f, "utf8");
  if (/\/verify-email\b/.test(t) || /verifyOtp\s*\(/.test(t)) {
    offenders.push(f);
  }
}
assert(
  offenders.length === 0,
  `no /verify-email or verifyOtp references in src/ (found: ${offenders.join(", ") || "none"})`,
);

console.log("\nAll signup-immediate-login checks passed for", email);
