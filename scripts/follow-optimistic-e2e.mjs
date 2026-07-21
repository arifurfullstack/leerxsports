#!/usr/bin/env node
/**
 * End-to-end Playwright test for optimistic follow/unfollow on a trainer page.
 *
 * Verifies three flows:
 *   1. Optimistic apply: follower count changes IMMEDIATELY when the button
 *      is clicked, before the toggleFollow server function resolves.
 *   2. Error rollback: when the server function fails, the count reverts
 *      to its previous value.
 *   3. Final reconciliation: after a successful toggle + invalidation the
 *      rendered count matches the value returned by getFollowCounts.
 *
 * Requires demo data seeded (Admin > Demo Data > Seed).
 *
 * Usage:
 *   BASE_URL=http://localhost:8080 \
 *   TRAINEE_EMAIL=trainee1@leerdemo.local TRAINEE_PASSWORD=DemoPass123! \
 *   TRAINER_USERNAME=coach_alex \
 *   node scripts/follow-optimistic-e2e.mjs
 */
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const EMAIL = process.env.TRAINEE_EMAIL ?? "trainee1@leerdemo.local";
const PASSWORD = process.env.TRAINEE_PASSWORD ?? "DemoPass123!";
const TRAINER = process.env.TRAINER_USERNAME;

if (!TRAINER) {
  console.error(
    "TRAINER_USERNAME is required. Pick any seeded trainer's username " +
      "(Admin > Users > trainers) and re-run.",
  );
  process.exit(2);
}

const results = [];
const step = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

/** Read the follower count integer from the trainer header. */
async function readFollowers(page) {
  const txt = await page
    .locator("span", { hasText: /^Followers?$/ })
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
  await page.waitForURL((u) => !/\/auth(\?|$)/.test(u.pathname), {
    timeout: 15000,
  });
}

async function ensureNotFollowing(page) {
  const btn = page.getByRole("button", { name: /^(Follow|Following)$/ }).first();
  await btn.waitFor({ state: "visible", timeout: 15000 });
  if ((await btn.innerText()).trim().toLowerCase().startsWith("following")) {
    await btn.click();
    await page.waitForFunction(
      () =>
        !!document.querySelector("button") &&
        Array.from(document.querySelectorAll("button")).some(
          (b) => b.textContent?.trim() === "Follow",
        ),
      { timeout: 10000 },
    );
  }
}

/** Capture the URL of the next network request triggered by clicking Follow. */
function captureNextRequest(page, predicate) {
  return page.waitForRequest(predicate, { timeout: 10000 });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 1800 },
});
const page = await context.newPage();

try {
  console.log(`→ Signing in as ${EMAIL}`);
  await signIn(page);

  console.log(`→ Opening /trainers/${TRAINER}`);
  await page.goto(`${BASE_URL}/trainers/${TRAINER}`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("button", { name: /^(Follow|Following)$/ })
    .first()
    .waitFor({ state: "visible", timeout: 15000 });

  await ensureNotFollowing(page);
  await page.waitForLoadState("networkidle").catch(() => {});

  const initial = await readFollowers(page);
  step("initial follower count read", Number.isFinite(initial), `count=${initial}`);

  // ─────────────────────────────────────────────────────────────
  // 1. Optimistic apply — count jumps before the request settles.
  // ─────────────────────────────────────────────────────────────
  // Slow the toggleFollow response so we can observe the optimistic tick.
  let followUrl = null;
  await page.route("**/*", async (route, req) => {
    if (
      req.method() === "POST" &&
      /toggleFollow|toggle_follow/i.test(req.url() + (req.postData() ?? ""))
    ) {
      followUrl = req.url();
      await new Promise((r) => setTimeout(r, 1500));
    }
    return route.continue();
  });

  const followBtn = page.getByRole("button", { name: /^Follow$/ }).first();
  const reqPromise = captureNextRequest(
    page,
    (r) =>
      r.method() === "POST" &&
      /toggleFollow|toggle_follow/i.test(r.url() + (r.postData() ?? "")),
  );
  await followBtn.click();

  // Snapshot count ~150ms into the delayed request → still optimistic.
  await page.waitForTimeout(150);
  const optimistic = await readFollowers(page);
  step(
    "optimistic count increments before request settles",
    optimistic === initial + 1,
    `expected ${initial + 1}, saw ${optimistic}`,
  );

  const req = await reqPromise;
  await req.response();
  await page.waitForLoadState("networkidle").catch(() => {});

  const afterFollow = await readFollowers(page);
  step(
    "count remains incremented after successful reconciliation",
    afterFollow === initial + 1,
    `expected ${initial + 1}, saw ${afterFollow}`,
  );
  step(
    "captured toggleFollow URL for rollback test",
    typeof followUrl === "string",
    followUrl ?? "none",
  );

  await page.unroute("**/*");

  // Bring state back to "not following" cleanly.
  await ensureNotFollowing(page);
  await page.waitForLoadState("networkidle").catch(() => {});
  const baseline = await readFollowers(page);
  step(
    "returned to baseline before rollback test",
    baseline === initial,
    `expected ${initial}, saw ${baseline}`,
  );

  // ─────────────────────────────────────────────────────────────
  // 2. Error rollback — server fails, count reverts.
  // ─────────────────────────────────────────────────────────────
  if (followUrl) {
    await page.route(followUrl, async (route) => {
      // Small delay so the optimistic tick is observable first.
      await new Promise((r) => setTimeout(r, 300));
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "forced test failure" }),
      });
    });

    await page.getByRole("button", { name: /^Follow$/ }).first().click();
    await page.waitForTimeout(100);
    const midFail = await readFollowers(page);
    step(
      "optimistic tick visible during failing request",
      midFail === baseline + 1,
      `expected ${baseline + 1}, saw ${midFail}`,
    );

    // Wait for the 500 to settle + rollback to run.
    await page.waitForTimeout(1200);
    const rolledBack = await readFollowers(page);
    step(
      "count rolls back to previous value on server error",
      rolledBack === baseline,
      `expected ${baseline}, saw ${rolledBack}`,
    );

    // Button should have reverted to "Follow" too.
    const label = (
      await page
        .getByRole("button", { name: /^(Follow|Following)$/ })
        .first()
        .innerText()
    ).trim();
    step(
      "button label rolls back to Follow after error",
      label === "Follow",
      `saw "${label}"`,
    );

    await page.unroute(followUrl);
  } else {
    step("error rollback test", false, "no toggleFollow URL captured");
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Final reconciliation matches server-side getFollowCounts.
  // ─────────────────────────────────────────────────────────────
  await page.getByRole("button", { name: /^Follow$/ }).first().click();
  await page.waitForLoadState("networkidle").catch(() => {});

  // Force a fresh mount so the count re-hydrates purely from the server.
  await page.goto(`${BASE_URL}/trainers/${TRAINER}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("networkidle").catch(() => {});
  const reloaded = await readFollowers(page);
  step(
    "reloaded count matches optimistic value (server-truth reconciliation)",
    reloaded === initial + 1,
    `expected ${initial + 1}, saw ${reloaded}`,
  );

  // Cleanup: unfollow so the test is idempotent.
  await ensureNotFollowing(page).catch(() => {});
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