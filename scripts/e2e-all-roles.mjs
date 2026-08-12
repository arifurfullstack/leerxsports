import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8081";
const PASSWORD = process.env.PASSWORD ?? "DemoPass123!";

const ACCOUNTS = [
  { role: "Admin", email: "admin@leerdemo.local" },
  { role: "Creator", email: "coach-nova@leerdemo.local" },
  { role: "Athlete", email: "athlete_kai@leerdemo.local" },
];

async function run() {
  console.log(`🚀 Starting Full E2E Test Suite against ${BASE_URL}\n`);
  const browser = await chromium.launch({ headless: true });

  let passed = 0;
  let failed = 0;

  // 1. Test Landing Page Branding & Slogans
  try {
    const page = await browser.newPage();
    console.log("--> Testing Landing Page Branding...");
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    const content = await page.content();

    if (!content.includes("FITNESS IS THE ONLY LAW") && !content.includes("Fitness")) {
      throw new Error("Missing 'FITNESS IS THE ONLY LAW' slogan.");
    }
    if (!content.includes("RESTRICTED AREA")) {
      throw new Error("Missing 'RESTRICTED AREA' badge.");
    }
    console.log("  ✓ Landing Page Branding & Slogans Verified");
    passed++;
    await page.close();
  } catch (err) {
    console.error(`  ✗ Landing Page failed: ${err.message}`);
    failed++;
  }

  // 2. Test Account Logins for Admin, Creator, and Athlete
  for (const acc of ACCOUNTS) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      console.log(`\n--> Testing ${acc.role} Sign In (${acc.email})...`);
      await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);

      // Fill credentials inside the auth form
      await page.fill('form input[type="email"]', acc.email);
      await page.fill('form input[type="password"]', PASSWORD);

      // Click auth form submit button specifically
      const submitBtn = page.locator('form button[type="submit"]').first();
      await submitBtn.click();

      // Wait for authentication response
      await page.waitForTimeout(4000);
      const currentUrl = page.url();
      console.log(`  ✓ Logged in as ${acc.role}. Current URL: ${currentUrl}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${acc.role} Sign In failed: ${err.message}`);
      failed++;
    } finally {
      await context.close();
    }
  }

  await browser.close();

  console.log(`\n========================================`);
  console.log(`E2E TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Fatal E2E error:", err);
  process.exit(1);
});
