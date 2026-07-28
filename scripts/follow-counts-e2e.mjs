#!/usr/bin/env node
/**
 * End-to-end Playwright test: follow/unfollow must
 *   1. flip the button label (Follow ↔ Following) immediately,
 *   2. bump the trainer's follower count on the trainer page,
 *   3. bump the viewer's own following count on their profile.
 *
 * Requires demo data seeded (Admin > Demo Data > Seed).
 *
 * Usage:
 *   BASE_URL=http://localhost:8080 \
 *   TRAINEE_EMAIL=trainee1@leerdemo.local TRAINEE_PASSWORD=DemoPass123! \
 *   TRAINEE_USERNAME=trainee1 TRAINER_USERNAME=coach_alex \
 *   node scripts/follow-counts-e2e.mjs
 */
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const EMAIL = process.env.TRAINEE_EMAIL ?? "trainee1@leerdemo.local";
const PASSWORD = process.env.TRAINEE_PASSWORD ?? "DemoPass123!";
const TRAINER = process.env.TRAINER_USERNAME;
const TRAINEE = process.env.TRAINEE_USERNAME;

if (!TRAINER || !TRAINEE) {
  console.error("TRAINER_USERNAME and TRAINEE_USERNAME are required.");
  process.exit(2);
}

const results = [];
const step = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

/** Read an integer count that sits immediately before a label span. */
async function readCountByLabel(page, labelRegex) {
  const txt = await page
    .locator("span", { hasText: labelRegex })
    .first()
    .locator("xpath=preceding-sibling::span[1]")
    .innerText();
  return Number(txt.replace(/[^\d]/g, ""));
}

async function signIn(page) {
  await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).first().fill(EMAIL);
  await page.getByLabel(/password/i).first().fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForURL((u) => !/\/auth(\?|$)/.test(u.pathname), { timeout: 15000 });
}

async function getFollowBtn(page) {
  const btn = page.getByRole("button", { name: /^(Follow|Following)$/ }).first();
  await btn.waitFor({ state: "visible", timeout: 15000 });
  return btn;
}

async function ensureNotFollowing(page) {
  const btn = await getFollowBtn(page);
  if ((await btn.innerText()).trim().toLowerCase().startsWith("following")) {
    await btn.click();
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("button")).some(
          (b) => b.textContent?.trim() === "Follow",
        ),
      { timeout: 10000 },
    );
  }
}

/** Read the viewer's own following count from /u/<username>. */
async function readViewerFollowing(page) {
  await page.goto(`${BASE_URL}/u/${TRAINEE}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  return readCountByLabel(page, /^Following$/);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
const page = await context.newPage();

try {
  console.log(`→ Signing in as ${EMAIL}`);
  await signIn(page);

  // Baseline the viewer's Following count on their own profile.
  const viewerFollowingBefore = await readViewerFollowing(page);
  step(
    "read viewer Following baseline",
    Number.isFinite(viewerFollowingBefore),
    `count=${viewerFollowingBefore}`,
  );

  console.log(`→ Opening /trainers/${TRAINER}`);
  await page.goto(`${BASE_URL}/trainers/${TRAINER}`, { waitUntil: "domcontentloaded" });
  await ensureNotFollowing(page);
  await page.waitForLoadState("networkidle").catch(() => {});

  const followersBefore = await readCountByLabel(page, /^Followers?$/);
  step("read trainer Followers baseline", Number.isFinite(followersBefore), `count=${followersBefore}`);

  // ── FOLLOW ────────────────────────────────────────────────
  await (await getFollowBtn(page)).click();

  // Immediate (optimistic) label flip.
  await page
    .getByRole("button", { name: /^Following$/ })
    .first()
    .waitFor({ state: "visible", timeout: 3000 });
  step("button flips to Following immediately", true);

  // Immediate optimistic follower bump.
  await page.waitForFunction(
    (expected) => {
      const label = Array.from(document.querySelectorAll("span")).find(
        (s) => /^Followers?$/.test(s.textContent?.trim() ?? ""),
      );
      const prev = label?.previousElementSibling;
      return Number((prev?.textContent ?? "").replace(/[^\d]/g, "")) === expected;
    },
    followersBefore + 1,
    { timeout: 3000 },
  );
  step("trainer follower count bumps by +1", true, `${followersBefore} → ${followersBefore + 1}`);

  await page.waitForLoadState("networkidle").catch(() => {});

  const viewerFollowingAfterFollow = await readViewerFollowing(page);
  step(
    "viewer Following count updates immediately after follow",
    viewerFollowingAfterFollow === viewerFollowingBefore + 1,
    `expected ${viewerFollowingBefore + 1}, saw ${viewerFollowingAfterFollow}`,
  );

  // ── UNFOLLOW ──────────────────────────────────────────────
  await page.goto(`${BASE_URL}/trainers/${TRAINER}`, { waitUntil: "domcontentloaded" });
  const followingBtn = await getFollowBtn(page);
  await followingBtn.click();

  await page
    .getByRole("button", { name: /^Follow$/ })
    .first()
    .waitFor({ state: "visible", timeout: 3000 });
  step("button flips back to Follow immediately", true);

  await page.waitForFunction(
    (expected) => {
      const label = Array.from(document.querySelectorAll("span")).find(
        (s) => /^Followers?$/.test(s.textContent?.trim() ?? ""),
      );
      const prev = label?.previousElementSibling;
      return Number((prev?.textContent ?? "").replace(/[^\d]/g, "")) === expected;
    },
    followersBefore,
    { timeout: 3000 },
  );
  step("trainer follower count returns to baseline", true, `→ ${followersBefore}`);

  await page.waitForLoadState("networkidle").catch(() => {});

  const viewerFollowingAfterUnfollow = await readViewerFollowing(page);
  step(
    "viewer Following count decrements after unfollow",
    viewerFollowingAfterUnfollow === viewerFollowingBefore,
    `expected ${viewerFollowingBefore}, saw ${viewerFollowingAfterUnfollow}`,
  );
} catch (err) {
  step("uncaught exception", false, err?.stack ?? String(err));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error("Failures:");
  for (const f of failed) console.error(`  - ${f.name}: ${f.detail}`);
  process.exit(1);
}