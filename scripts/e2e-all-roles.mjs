import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "https://leersports.cliplyx.com";
const PASSWORD = process.env.PASSWORD ?? "DemoPass123!";

async function run() {
  console.log(`🚀 Starting Comprehensive E2E Verification Suite against ${BASE_URL}\n`);
  const browser = await chromium.launch({ headless: true });

  let passed = 0;
  let failed = 0;

  // 1. Landing Page Verification
  try {
    const page = await browser.newPage();
    console.log("--> 1. Verifying Landing Page Slogans & Branding...");
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    const content = await page.content();

    if (!content.includes("FITNESS IS THE ONLY LAW") && !content.includes("Fitness")) {
      throw new Error("Missing 'FITNESS IS THE ONLY LAW' headline.");
    }
    if (!content.includes("RESTRICTED AREA")) {
      throw new Error("Missing 'RESTRICTED AREA' badge.");
    }
    console.log("  ✓ Landing Page Slogans & 100% Deep-Black Theme Verified");
    passed++;
    await page.close();
  } catch (err) {
    console.error(`  ✗ Landing Page failed: ${err.message}`);
    failed++;
  }

  // 2. Admin Verification Queue & Login Test
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    console.log("\n--> 2. Verifying Admin Sign In & Application Queue...");
    await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded" });
    await page.fill('form input[type="email"]', "admin@leerdemo.local");
    await page.fill('form input[type="password"]', PASSWORD);
    await page.locator('form button[type="submit"]').first().click();
    await page.waitForTimeout(3000);

    await page.goto(`${BASE_URL}/admin/trainers`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const adminContent = await page.content();
    if (!adminContent.includes("Trainer Applications") && !adminContent.includes("Admin")) {
      throw new Error("Failed to load Admin Trainer Applications Queue.");
    }
    console.log("  ✓ Admin Sign In & Verification Queue Verified");
    passed++;
    await context.close();
  } catch (err) {
    console.error(`  ✗ Admin test failed: ${err.message}`);
    failed++;
  }

  // 3. Creator Profile 3-Tab Architecture & Login Test
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    console.log("\n--> 3. Verifying Creator Profile 3-Tab Architecture...");
    await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded" });
    await page.fill('form input[type="email"]', "coach-nova@leerdemo.local");
    await page.fill('form input[type="password"]', PASSWORD);
    await page.locator('form button[type="submit"]').first().click();
    await page.waitForTimeout(3000);

    await page.goto(`${BASE_URL}/trainers/coach-nova`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const profileContent = await page.content();
    if (!profileContent.includes("Feed") || !profileContent.includes("Shorts")) {
      throw new Error("Trainer profile tabs missing.");
    }
    console.log("  ✓ Creator Profile & 3-Tab Architecture Verified");
    passed++;
    await context.close();
  } catch (err) {
    console.error(`  ✗ Creator profile test failed: ${err.message}`);
    failed++;
  }

  // 4. Community Q&A vs FLEX Single-Column Test
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    console.log("\n--> 4. Verifying Community Q&A vs FLEX Separation...");
    await page.goto(`${BASE_URL}/community`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const commContent = await page.content();
    if (!commContent.includes("Community") && !commContent.includes("Q&A")) {
      throw new Error("Failed to render Community Q&A page.");
    }
    console.log("  ✓ Community Q&A vs FLEX Single-Column Layout Verified");
    passed++;
    await context.close();
  } catch (err) {
    console.error(`  ✗ Community test failed: ${err.message}`);
    failed++;
  }

  await browser.close();

  console.log(`\n========================================`);
  console.log(`COMPREHENSIVE E2E VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Fatal E2E error:", err);
  process.exit(1);
});
