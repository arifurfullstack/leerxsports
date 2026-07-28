#!/usr/bin/env node
/**
 * E2E: verify that signing in as an admin user (with no explicit intent /
 * redirect) lands on /admin AND that the dashboard content renders.
 *
 * Usage:
 *   BASE_URL=http://localhost:8080 \
 *   ADMIN_EMAIL=admin@leerdemo.local ADMIN_PASSWORD=LeerAdmin!2026 \
 *   node scripts/admin-login-redirect.mjs
 */
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@leerdemo.local";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "LeerAdmin!2026";

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
};
const pass = (msg) => console.log(`✓ ${msg}`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
const page = await context.newPage();

try {
  // 1. Go straight to /auth WITHOUT ?intent=admin — the role-based
  //    redirect in AuthForm must still route admins to /admin.
  console.log(`→ Visiting ${BASE_URL}/auth`);
  await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded" });

  await page.getByLabel(/email/i).first().fill(EMAIL);
  await page.getByLabel(/password/i).first().fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();

  // 2. Assert redirect to /admin (not /home).
  await page.waitForURL(/\/admin(?:\/|$|\?)/, { timeout: 15000 });
  const pathname = new URL(page.url()).pathname;
  if (pathname !== "/admin") {
    fail(`expected pathname "/admin", got "${pathname}"`);
  } else {
    pass(`redirected to ${pathname}`);
  }

  // 3. Assert dashboard content actually rendered (not a blank page or the
  //    error boundary).
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

  const heading = page.getByRole("heading", { name: /dashboard/i }).first();
  await heading.waitFor({ state: "visible", timeout: 10000 });
  pass("dashboard heading visible");

  const keyMetrics = page.locator('section[aria-label="Key metrics"]');
  await keyMetrics.waitFor({ state: "visible", timeout: 10000 });
  const cardCount = await keyMetrics.locator("> div").count();
  if (cardCount < 4) {
    fail(`expected >=4 metric cards, got ${cardCount}`);
  } else {
    pass(`rendered ${cardCount} metric cards`);
  }

  const body = await page.locator("body").innerText();
  if (/couldn't load dashboard metrics|something went wrong|application error/i.test(body)) {
    fail("error boundary rendered on /admin");
  } else {
    pass("no error boundary");
  }
} catch (err) {
  fail(err?.message ?? String(err));
} finally {
  await browser.close();
}

if (process.exitCode) {
  console.error("\nadmin-login-redirect FAILED");
  process.exit(process.exitCode);
}
console.log("\nadmin-login-redirect OK");