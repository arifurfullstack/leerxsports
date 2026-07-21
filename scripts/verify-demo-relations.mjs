#!/usr/bin/env node
/**
 * Verify that seeded demo data is fully linked.
 *
 * Runs a battery of relational-integrity checks against the database and
 * reports any orphaned or missing relations across the seeded surfaces:
 *   - trainers  ↔ posts
 *   - community threads ↔ replies
 *   - commerce  ↔ transactions / tips / balances / payouts
 *   - moderation ↔ reports / actions / strikes
 *   - coaching  ↔ messages / disputes
 *
 * Uses psql via the ambient PG* env vars (sandbox default). Exits with
 * code 1 when any check reports a missing relation.
 *
 *   node scripts/verify-demo-relations.mjs
 */
import { spawnSync } from "node:child_process";

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GRN = "\x1b[32m";
const YEL = "\x1b[33m";
const DIM = "\x1b[2m";

/** @type {{name: string, description: string, sql: string, severity?: "warn"|"error"}[]} */
const checks = [
  {
    name: "demo_trainer_has_posts",
    description: "Every demo trainer has at least one post",
    sql: `
      SELECT p.user_id::text AS id, p.username
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'trainer'
      WHERE p.is_demo
        AND NOT EXISTS (
          SELECT 1 FROM public.posts po
          WHERE po.trainer_id = p.user_id AND po.is_demo
        )
    `,
  },
  {
    name: "demo_post_trainer_exists",
    description: "Every demo post links to an existing demo trainer profile",
    sql: `
      SELECT po.id::text AS id, po.trainer_id::text AS trainer_id
      FROM public.posts po
      WHERE po.is_demo
        AND NOT EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = po.trainer_id AND p.is_demo
        )
    `,
  },
  {
    name: "community_thread_has_reply",
    description: "Every demo community thread has at least one reply",
    severity: "warn",
    sql: `
      SELECT cp.id::text AS id, cp.title
      FROM public.community_posts cp
      WHERE cp.is_demo
        AND NOT EXISTS (
          SELECT 1 FROM public.community_comments cc
          WHERE cc.post_id = cp.id AND cc.status = 'visible'
        )
    `,
  },
  {
    name: "community_comment_thread_exists",
    description: "Every community comment references an existing thread",
    sql: `
      SELECT cc.id::text AS id
      FROM public.community_comments cc
      LEFT JOIN public.community_posts cp ON cp.id = cc.post_id
      WHERE cp.id IS NULL
    `,
  },
  {
    name: "community_author_exists",
    description: "Every community thread author has a profile",
    sql: `
      SELECT cp.id::text AS id
      FROM public.community_posts cp
      LEFT JOIN public.profiles p ON p.user_id = cp.author_id
      WHERE cp.is_demo AND p.user_id IS NULL
    `,
  },
  {
    name: "transaction_has_source",
    description: "Every transaction links to its subscription or tip source",
    sql: `
      SELECT t.id::text AS id, t.kind
      FROM public.transactions t
      WHERE
        (t.kind = 'subscription' AND (t.subscription_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.subscriptions s WHERE s.id = t.subscription_id
        )))
        OR
        (t.kind = 'tip' AND (t.tip_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.tips tp WHERE tp.id = t.tip_id
        )))
    `,
  },
  {
    name: "transaction_trainer_exists",
    description: "Every transaction references an existing trainer profile",
    sql: `
      SELECT t.id::text AS id
      FROM public.transactions t
      LEFT JOIN public.profiles p ON p.user_id = t.trainer_id
      WHERE p.user_id IS NULL
    `,
  },
  {
    name: "tip_linked_to_transaction",
    description: "Every succeeded tip links to a transaction",
    severity: "warn",
    sql: `
      SELECT tp.id::text AS id
      FROM public.tips tp
      WHERE tp.status = 'succeeded'
        AND (tp.transaction_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.transactions t WHERE t.id = tp.transaction_id
        ))
    `,
  },
  {
    name: "trainer_balance_matches_transactions",
    description: "Trainer balances exist for every trainer with transactions",
    sql: `
      SELECT DISTINCT t.trainer_id::text AS trainer_id
      FROM public.transactions t
      LEFT JOIN public.trainer_balances b ON b.trainer_id = t.trainer_id
      WHERE b.trainer_id IS NULL
    `,
  },
  {
    name: "payout_trainer_exists",
    description: "Every payout references an existing trainer",
    sql: `
      SELECT po.id::text AS id
      FROM public.payouts po
      LEFT JOIN public.profiles p ON p.user_id = po.trainer_id
      WHERE p.user_id IS NULL
    `,
  },
  {
    name: "subscription_participants_exist",
    description: "Every subscription references existing subscriber + trainer",
    sql: `
      SELECT s.id::text AS id
      FROM public.subscriptions s
      LEFT JOIN public.profiles sp ON sp.user_id = s.subscriber_id
      LEFT JOIN public.profiles tp ON tp.user_id = s.trainer_id
      WHERE sp.user_id IS NULL OR tp.user_id IS NULL
    `,
  },
  {
    name: "report_target_exists",
    description: "Every report points at an existing target row",
    sql: `
      SELECT r.id::text AS id, r.target_type::text AS target_type, r.target_id::text AS target_id
      FROM public.reports r
      WHERE
        (r.target_type = 'post'              AND NOT EXISTS (SELECT 1 FROM public.posts x WHERE x.id = r.target_id))
        OR (r.target_type = 'community_post' AND NOT EXISTS (SELECT 1 FROM public.community_posts x WHERE x.id = r.target_id))
        OR (r.target_type = 'community_comment' AND NOT EXISTS (SELECT 1 FROM public.community_comments x WHERE x.id = r.target_id))
        OR (r.target_type = 'comment'        AND NOT EXISTS (SELECT 1 FROM public.comments x WHERE x.id = r.target_id))
        OR (r.target_type = 'transformation' AND NOT EXISTS (SELECT 1 FROM public.transformation_posts x WHERE x.id = r.target_id))
        OR (r.target_type = 'profile'        AND NOT EXISTS (SELECT 1 FROM public.profiles x WHERE x.user_id = r.target_id))
    `,
  },
  {
    name: "report_reporter_exists",
    description: "Every report has a valid reporter profile",
    sql: `
      SELECT r.id::text AS id
      FROM public.reports r
      LEFT JOIN public.profiles p ON p.user_id = r.reporter_id
      WHERE p.user_id IS NULL
    `,
  },
  {
    name: "moderation_action_target_exists",
    description: "Every moderation action points at an existing target",
    sql: `
      SELECT m.id::text AS id, m.target_type::text AS target_type
      FROM public.moderation_actions m
      WHERE
        (m.target_type = 'post'              AND NOT EXISTS (SELECT 1 FROM public.posts x WHERE x.id = m.target_id))
        OR (m.target_type = 'community_post' AND NOT EXISTS (SELECT 1 FROM public.community_posts x WHERE x.id = m.target_id))
        OR (m.target_type = 'community_comment' AND NOT EXISTS (SELECT 1 FROM public.community_comments x WHERE x.id = m.target_id))
        OR (m.target_type = 'comment'        AND NOT EXISTS (SELECT 1 FROM public.comments x WHERE x.id = m.target_id))
        OR (m.target_type = 'transformation' AND NOT EXISTS (SELECT 1 FROM public.transformation_posts x WHERE x.id = m.target_id))
        OR (m.target_type = 'profile'        AND NOT EXISTS (SELECT 1 FROM public.profiles x WHERE x.user_id = m.target_id))
    `,
  },
  {
    name: "strike_trainer_exists",
    description: "Every trainer strike references an existing trainer + optional dispute",
    sql: `
      SELECT s.id::text AS id
      FROM public.trainer_strikes s
      LEFT JOIN public.profiles p ON p.user_id = s.trainer_id
      WHERE p.user_id IS NULL
         OR (s.dispute_id IS NOT NULL AND NOT EXISTS (
              SELECT 1 FROM public.coaching_disputes d WHERE d.id = s.dispute_id))
         OR (s.moderation_action_id IS NOT NULL AND NOT EXISTS (
              SELECT 1 FROM public.moderation_actions m WHERE m.id = s.moderation_action_id))
    `,
  },
  {
    name: "coaching_thread_has_message",
    description: "Every coached/completed coaching request has at least one message",
    severity: "warn",
    sql: `
      SELECT c.id::text AS id, c.status::text AS status
      FROM public.coaching_requests c
      WHERE c.status IN ('coached','follow_up_submitted','final_response_submitted','coaching_completed')
        AND NOT EXISTS (SELECT 1 FROM public.coaching_messages m WHERE m.thread_id = c.id)
    `,
  },
  {
    name: "coaching_message_thread_exists",
    description: "Every coaching message references an existing thread + sender",
    sql: `
      SELECT m.id::text AS id
      FROM public.coaching_messages m
      LEFT JOIN public.coaching_requests c ON c.id = m.thread_id
      LEFT JOIN public.profiles p ON p.user_id = m.sender_id
      WHERE c.id IS NULL OR p.user_id IS NULL
    `,
  },
  {
    name: "dispute_thread_exists",
    description: "Every coaching dispute references an existing thread + opener",
    sql: `
      SELECT d.id::text AS id
      FROM public.coaching_disputes d
      LEFT JOIN public.coaching_requests c ON c.id = d.thread_id
      LEFT JOIN public.profiles p ON p.user_id = d.opener_id
      WHERE c.id IS NULL OR p.user_id IS NULL
    `,
  },
  {
    name: "transformation_owner_exists",
    description: "Every demo transformation post has an owner profile",
    sql: `
      SELECT tp.id::text AS id
      FROM public.transformation_posts tp
      LEFT JOIN public.profiles p ON p.user_id = tp.user_id
      WHERE tp.is_demo AND p.user_id IS NULL
    `,
  },
];

function runSql(sql) {
  const res = spawnSync(
    "psql",
    ["-A", "-t", "-F", "\u001f", "--no-align", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { encoding: "utf8" },
  );
  if (res.status !== 0) {
    const err = new Error(`psql failed: ${res.stderr?.trim() || res.status}`);
    err.stderr = res.stderr;
    throw err;
  }
  return res.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

let hardFail = 0;
let warn = 0;
const summary = [];

console.log(`${DIM}Verifying demo relations against ${process.env.PGHOST || "local db"}…${RESET}\n`);

for (const check of checks) {
  process.stdout.write(`• ${check.name} — ${DIM}${check.description}${RESET} … `);
  try {
    const rows = runSql(check.sql);
    if (rows.length === 0) {
      console.log(`${GRN}OK${RESET}`);
      summary.push({ name: check.name, status: "ok", violations: 0 });
      continue;
    }
    const sev = check.severity ?? "error";
    const label = sev === "warn" ? `${YEL}WARN${RESET}` : `${RED}FAIL${RESET}`;
    console.log(`${label} (${rows.length} violation${rows.length === 1 ? "" : "s"})`);
    for (const r of rows.slice(0, 5)) {
      console.log(`    ↳ ${r.replaceAll("\u001f", " | ")}`);
    }
    if (rows.length > 5) console.log(`    ↳ …and ${rows.length - 5} more`);
    summary.push({ name: check.name, status: sev, violations: rows.length });
    if (sev === "error") hardFail += rows.length;
    else warn += rows.length;
  } catch (e) {
    console.log(`${RED}ERROR${RESET}`);
    console.log(`    ↳ ${e.message}`);
    if (e.stderr) console.log(`    ↳ ${e.stderr.trim().split("\n").pop()}`);
    summary.push({ name: check.name, status: "error", violations: 1 });
    hardFail++;
  }
}

const ok = summary.filter((s) => s.status === "ok").length;
const errored = summary.filter((s) => s.status === "error").length;
const warned = summary.filter((s) => s.status === "warn").length;

console.log(
  `\n${DIM}Summary:${RESET} ${GRN}${ok} OK${RESET} · ${YEL}${warned} warn${RESET} · ${RED}${errored} fail${RESET}` +
    ` (${hardFail} hard violation${hardFail === 1 ? "" : "s"}, ${warn} soft)`,
);

process.exit(hardFail > 0 ? 1 : 0);