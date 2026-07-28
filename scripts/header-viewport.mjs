#!/usr/bin/env node
/**
 * Automated viewport check for the site header.
 *
 * Asserts that <header> and its inner row span 100% of the viewport width
 * (no left offset, no horizontal scroll) on the public routes /, /feed, and
 * /browse across common mobile, tablet, and desktop breakpoints.
 *
 * Usage:
 *   BASE_URL=http://localhost:8080 node scripts/header-viewport.mjs
 */
import { chromium } from "playwright";
import { existsSync, readdirSync } from "node:fs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const ROUTES = ["/", "/feed", "/browse"];
const WIDTHS = [320, 360, 375, 414, 768, 1024, 1280, 1536, 1920];
const TOLERANCE = 0.5;

const failures = [];
const results = [];

// Support the sandbox layout where the bundled Chromium version may differ from
// the one Playwright expects. Fall back to a discovered install under
// PLAYWRIGHT_BROWSERS_PATH before letting Playwright search on its own.
function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/";
  try {
    for (const dir of readdirSync(base)) {
      if (!/^chromium(_headless_shell)?-\d+$/.test(dir)) continue;
      const bin = `${base.replace(/\/$/, "")}/${dir}/chrome-linux/${dir.startsWith("chromium_headless_shell") ? "headless_shell" : "chrome"}`;
      if (existsSync(bin)) return bin;
    }
  } catch {}
  return undefined;
}
const launchOpts = { headless: true };
const exe = findChromium();
if (exe) launchOpts.executablePath = exe;
const browser = await chromium.launch(launchOpts);
try {
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    for (const route of ROUTES) {
      const url = `${BASE_URL}${route}`;
      await page.goto(url, { waitUntil: "load", timeout: 20_000 });
      await page.waitForSelector("header", { timeout: 10_000 });
      await page.waitForTimeout(400);

      const m = await page.evaluate(() => {
        const header = document.querySelector("header");
        if (!header) return null;
        const inner = header.querySelector("div.grid");
        const hr = header.getBoundingClientRect();
        const ir = inner?.getBoundingClientRect();
        return {
          vw: window.innerWidth,
          hw: hr.width, hl: hr.left,
          iw: ir?.width ?? null, il: ir?.left ?? null,
          scroll: document.documentElement.scrollWidth,
        };
      });

      if (!m) { failures.push(`${width}px ${route}: <header> not found`); continue; }

      const problems = [];
      if (Math.abs(m.hl) > TOLERANCE) problems.push(`header.left=${m.hl}`);
      if (Math.abs(m.hw - m.vw) > TOLERANCE) problems.push(`header.width=${m.hw} !== vw=${m.vw}`);
      if (m.iw === null) problems.push("inner grid row missing");
      else {
        if (Math.abs(m.il) > TOLERANCE) problems.push(`inner.left=${m.il}`);
        if (Math.abs(m.iw - m.vw) > TOLERANCE) problems.push(`inner.width=${m.iw} !== vw=${m.vw}`);
      }
      if (m.scroll - m.vw > TOLERANCE) problems.push(`scrollWidth=${m.scroll} > vw=${m.vw}`);

      const status = problems.length === 0 ? "PASS" : "FAIL";
      results.push({ width, route, status, m, problems });
      if (problems.length) failures.push(`${width}px ${route}: ${problems.join("; ")}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}

for (const r of results) {
  console.log(`${r.status.padEnd(4)} ${String(r.width).padStart(4)}px ${r.route.padEnd(8)} header=${r.m.hw}@${r.m.hl} inner=${r.m.iw}@${r.m.il}`);
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s):`);
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}
console.log(`\nAll ${results.length} checks passed.`);
