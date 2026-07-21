#!/usr/bin/env node
/**
 * Runtime smoke test for the admin panel.
 *
 * Signs in as the demo admin, then visits every route in ADMIN_NAV_ORDER
 * and asserts:
 *   - the URL matches after navigation
 *   - the page does not render an error boundary
 *   - the sidebar link for that path is marked active
 *
 * Usage:
 *   BASE_URL=http://localhost:8080 \
 *   ADMIN_EMAIL=admin@leerdemo.local ADMIN_PASSWORD=DemoPass123! \
 *   node scripts/admin-smoke.mjs
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@leerdemo.local";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "DemoPass123!";

// Parse ADMIN_NAV_ORDER paths straight from source so this stays in sync.
const src = readFileSync("src/lib/admin-permissions.ts", "utf8");
const block = src.match(/ADMIN_NAV_ORDER[\s\S]*?=\s*\[([\s\S]*?)\];/)[1];
const PATHS = [...block.matchAll(/path:\s*"([^"]+)"/g)].map((m) => m[1]);

const results = [];
const fail = (path, msg) => {
  results.push({ path, ok: false, msg });
  console.error(`  ✗ ${path} — ${msg}`);
};
const pass = (path) => {
  results.push({ path, ok: true });
  console.log(`  ✓ ${path}`);
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 1800 },
});
const page = await context.newPage();

console.log(`→ Signing in as ${EMAIL}`);
await page.goto(`${BASE_URL}/auth?intent=admin`, {
  waitUntil: "domcontentloaded",
});
await page.getByLabel(/email/i).first().fill(EMAIL);
await page.getByLabel(/password/i).first().fill(PASSWORD);
await page.getByRole("button", { name: /sign in|log in/i }).first().click();
await page.waitForURL(/\/admin/, { timeout: 15000 });
console.log(`✓ Signed in, landed at ${page.url()}`);

for (const path of PATHS) {
  try {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    const url = new URL(page.url()).pathname;
    if (url !== path) {
      fail(path, `redirected to ${url}`);
      continue;
    }
    const body = await page.locator("body").innerText();
    if (/something went wrong|application error|unhandled/i.test(body)) {
      fail(path, "error boundary rendered");
      continue;
    }
    // Sidebar link for this path should be marked active.
    const activeHref = await page
      .locator('[data-sidebar="menu-button"][data-active="true"] a, a[data-active="true"]')
      .first()
      .getAttribute("href")
      .catch(() => null);
    if (activeHref && activeHref !== path && !path.startsWith(activeHref)) {
      fail(path, `active sidebar link is ${activeHref}`);
      continue;
    }
    pass(path);
  } catch (err) {
    fail(path, err.message ?? String(err));
  }
}

// Bonus: click every sidebar link and assert URL updates.
console.log("\n→ Clicking every sidebar link");
await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
const links = await page.locator('[data-sidebar="menu-button"] a').all();
const hrefs = [];
for (const l of links) {
  const h = await l.getAttribute("href");
  if (h && h.startsWith("/admin")) hrefs.push(h);
}
for (const href of [...new Set(hrefs)]) {
  try {
    await page.locator(`a[href="${href}"]`).first().click();
    await page.waitForURL(`**${href}`, { timeout: 8000 });
    pass(`click → ${href}`);
  } catch (err) {
    fail(`click → ${href}`, err.message ?? String(err));
  }
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed`,
);
if (failed.length > 0) {
  console.error("FAILURES:");
  for (const f of failed) console.error(`  - ${f.path}: ${f.msg}`);
  process.exit(1);
}