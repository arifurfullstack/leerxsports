#!/usr/bin/env node
/**
 * E2E: sign in as admin, update website settings (site name, meta,
 * OG image, favicon), save, then verify the public root's <head> meta
 * tags reflect the new values.
 *
 * Usage:
 *   BASE_URL=http://localhost:8080 \
 *   ADMIN_EMAIL=admin@leerdemo.local ADMIN_PASSWORD=LeerAdmin!2026 \
 *   node scripts/website-settings-e2e.mjs
 */
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@leerdemo.local";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "LeerAdmin!2026";

const stamp = Date.now();
const NEW = {
  site_name: `LEER E2E ${stamp}`,
  tagline: `Tagline E2E ${stamp}`,
  meta_title: `Meta Title E2E ${stamp}`,
  meta_description: `Meta description generated for e2e run ${stamp}.`,
  og_title: `OG Title E2E ${stamp}`,
  og_description: `OG description e2e ${stamp}`,
  og_image_url: `https://picsum.photos/seed/leer-${stamp}/1200/630.jpg`,
  favicon_url: `https://picsum.photos/seed/leer-fav-${stamp}/64/64.png`,
  theme_color: "#ff2244",
};

const pass = (m) => console.log(`✓ ${m}`);
const fail = (m) => { console.error(`✗ ${m}`); process.exitCode = 1; };

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
const page = await context.newPage();

try {
  // 1. Sign in as admin.
  await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).first().fill(EMAIL);
  await page.getByLabel(/password/i).first().fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForURL(/\/admin(?:\/|$|\?)/, { timeout: 20000 });
  pass("signed in as admin");

  // 2. Go to website settings.
  await page.goto(`${BASE_URL}/admin/website`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /website settings/i }).waitFor({ timeout: 15000 });
  pass("website settings page loaded");

  // Snapshot originals to restore later.
  const originals = {};
  for (const key of Object.keys(NEW)) {
    originals[key] = await page.locator(`#${key}`).inputValue().catch(() => "");
  }

  // 3. Fill new values.
  for (const [key, value] of Object.entries(NEW)) {
    const input = page.locator(`#${key}`);
    await input.fill("");
    await input.fill(value);
  }
  pass("filled new settings");

  // 4. Save and wait for success toast.
  await page.getByRole("button", { name: /save changes/i }).click();
  await page.getByText(/website settings saved/i).waitFor({ timeout: 20000 });
  pass("save succeeded");

  // 5. Open the public root in a fresh context (no auth), verify head tags.
  const publicCtx = await browser.newContext();
  const publicPage = await publicCtx.newPage();
  await publicPage.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  // Give TanStack Query loader a beat to populate head().
  await publicPage.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

  const head = await publicPage.evaluate(() => {
    const get = (sel, attr = "content") =>
      document.head.querySelector(sel)?.getAttribute(attr) ?? null;
    return {
      title: document.title,
      description: get('meta[name="description"]'),
      ogTitle: get('meta[property="og:title"]'),
      ogDescription: get('meta[property="og:description"]'),
      ogImage: get('meta[property="og:image"]'),
      twitterImage: get('meta[name="twitter:image"]'),
      themeColor: get('meta[name="theme-color"]'),
      favicon: get('link[rel="icon"]', "href") || get('link[rel="shortcut icon"]', "href"),
    };
  });

  const checks = [
    ["title contains site_name", () => head.title?.includes(NEW.site_name) || head.title === NEW.meta_title],
    ["meta description", () => head.description === NEW.meta_description],
    ["og:title", () => head.ogTitle === NEW.og_title],
    ["og:description", () => head.ogDescription === NEW.og_description],
    ["og:image", () => head.ogImage === NEW.og_image_url],
    ["theme-color", () => (head.themeColor || "").toLowerCase() === NEW.theme_color.toLowerCase()],
    ["favicon", () => head.favicon === NEW.favicon_url],
  ];
  for (const [name, fn] of checks) {
    fn() ? pass(name) : fail(`${name} — got ${JSON.stringify(head)}`);
  }

  await publicCtx.close();

  // 6. Restore originals so the run is idempotent.
  await page.bringToFront();
  await page.goto(`${BASE_URL}/admin/website`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /website settings/i }).waitFor({ timeout: 15000 });
  for (const [key, value] of Object.entries(originals)) {
    const input = page.locator(`#${key}`);
    await input.fill("");
    if (value) await input.fill(value);
  }
  await page.getByRole("button", { name: /save changes/i }).click();
  await page.getByText(/website settings saved/i).waitFor({ timeout: 20000 }).catch(() => {});
  pass("restored original settings");
} catch (err) {
  fail(err?.message ?? String(err));
} finally {
  await browser.close();
}

if (process.exitCode) {
  console.error("\nwebsite-settings-e2e FAILED");
  process.exit(process.exitCode);
}
console.log("\nwebsite-settings-e2e OK");
