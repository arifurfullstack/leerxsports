#!/usr/bin/env node
/**
 * Visual regression test for the homepage hero headline.
 *
 * At each key viewport, measures the two headline lines' layout
 * (bounding rect, computed typography, client-rect count, overflow)
 * and compares against a stored baseline. Also writes a PNG of the
 * headline for manual review under tests/visual/screenshots/.
 *
 * Rationale: pixel diffs are brittle across font-metric changes; layout
 * metrics catch the concrete failure modes we care about (wrap changes,
 * spacing changes, overflow) with meaningful error messages.
 *
 * Usage:
 *   BASE_URL=http://localhost:8080 node scripts/hero-visual-regression.mjs
 *   UPDATE_BASELINE=1 node scripts/hero-visual-regression.mjs   # rewrite baseline
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { execSync } from "node:child_process";

// Resolve a chromium binary. Prefers Playwright's managed browser; falls
// back to any chrome-headless-shell already present in the sandbox at /.
function resolveChromiumExecutable() {
  if (process.env.CHROMIUM_EXECUTABLE) return process.env.CHROMIUM_EXECUTABLE;
  try {
    const found = execSync(
      "ls /chromium_headless_shell-*/chrome-linux/headless_shell 2>/dev/null | head -n1",
      { encoding: "utf8" },
    ).trim();
    if (found) return found;
  } catch {}
  return undefined;
}

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const BASELINE_PATH = "tests/visual/hero-headline.baseline.json";
const SHOT_DIR = "tests/visual/screenshots";
const UPDATE = process.env.UPDATE_BASELINE === "1";

// Viewports we care about: common mobile widths, tablet, laptop, desktop, wide.
const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 780 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-414", width: 414, height: 896 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "laptop-1024", width: 1024, height: 768 },
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "wide-1440", width: 1440, height: 900 },
];

// Tolerances — allow small sub-pixel/rendering variance but flag real changes.
const TOL = {
  widthPx: 2,     // headline line width may drift by up to 2px between runs
  heightPx: 2,
  fontSizePx: 0.5,
  spacingEm: 0.005, // letter-spacing / word-spacing in em
  lineCount: 0,   // wrap changes must be exact
  overflow: 0,    // overflow flag must match exactly
};

mkdirSync(SHOT_DIR, { recursive: true });
mkdirSync(dirname(BASELINE_PATH), { recursive: true });

function parsePx(v) {
  if (!v || v === "normal") return 0;
  return parseFloat(v);
}

async function measure(page) {
  return page.evaluate(() => {
    const h1 = document.querySelector('[aria-label="Fitness Is The Only Law"]');
    if (!h1) throw new Error("Hero h1 not found");
    const lines = h1.querySelectorAll(".hero-reveal");
    const vw = window.innerWidth;
    const measured = [];
    lines.forEach((el, idx) => {
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const clientRects = el.getClientRects().length;
      measured.push({
        index: idx,
        text: el.textContent?.trim() ?? "",
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
        fontSize: parseFloat(cs.fontSize),
        letterSpacing: cs.letterSpacing,
        wordSpacing: cs.wordSpacing,
        lineHeight: cs.lineHeight,
        // A single unbroken line should produce exactly one client rect.
        lineCount: clientRects,
        // Overflow indicator: does the line extend past the viewport edge?
        overflowsViewport: rect.right > vw + 0.5 || rect.left < -0.5,
      });
    });
    return { viewportWidth: vw, lines: measured };
  });
}

function emToNumber(spacingStr, fontSizePx) {
  // computed style returns letter/word spacing in px; convert to em for stability
  const px = parsePx(spacingStr);
  return fontSizePx ? px / fontSizePx : 0;
}

function normalize(sample) {
  return {
    viewportWidth: sample.viewportWidth,
    lines: sample.lines.map((l) => ({
      index: l.index,
      text: l.text,
      width: l.width,
      height: l.height,
      fontSize: Math.round(l.fontSize * 100) / 100,
      letterSpacingEm: Math.round(emToNumber(l.letterSpacing, l.fontSize) * 1000) / 1000,
      wordSpacingEm: Math.round(emToNumber(l.wordSpacing, l.fontSize) * 1000) / 1000,
      lineCount: l.lineCount,
      overflowsViewport: l.overflowsViewport,
    })),
  };
}

function diff(actual, baseline, label) {
  const problems = [];
  if (actual.lines.length !== baseline.lines.length) {
    problems.push(`${label}: line count changed (${baseline.lines.length} → ${actual.lines.length})`);
    return problems;
  }
  for (let i = 0; i < actual.lines.length; i++) {
    const a = actual.lines[i];
    const b = baseline.lines[i];
    const tag = `${label}/line[${i}]("${a.text}")`;
    if (a.text !== b.text) problems.push(`${tag}: text changed ("${b.text}" → "${a.text}")`);
    if (Math.abs(a.width - b.width) > TOL.widthPx)
      problems.push(`${tag}: width ${b.width}px → ${a.width}px (>${TOL.widthPx}px)`);
    if (Math.abs(a.height - b.height) > TOL.heightPx)
      problems.push(`${tag}: height ${b.height}px → ${a.height}px (>${TOL.heightPx}px)`);
    if (Math.abs(a.fontSize - b.fontSize) > TOL.fontSizePx)
      problems.push(`${tag}: font-size ${b.fontSize}px → ${a.fontSize}px`);
    if (Math.abs(a.letterSpacingEm - b.letterSpacingEm) > TOL.spacingEm)
      problems.push(`${tag}: letter-spacing ${b.letterSpacingEm}em → ${a.letterSpacingEm}em`);
    if (Math.abs(a.wordSpacingEm - b.wordSpacingEm) > TOL.spacingEm)
      problems.push(`${tag}: word-spacing ${b.wordSpacingEm}em → ${a.wordSpacingEm}em`);
    if (a.lineCount !== b.lineCount)
      problems.push(`${tag}: wrap changed (${b.lineCount} client rect(s) → ${a.lineCount}) — text is wrapping unexpectedly`);
    if (a.overflowsViewport !== b.overflowsViewport)
      problems.push(`${tag}: overflow flag changed (${b.overflowsViewport} → ${a.overflowsViewport})`);
  }
  return problems;
}

async function run() {
  const executablePath = resolveChromiumExecutable();
  const browser = await chromium.launch({ headless: true, executablePath });
  const results = {};
  const problems = [];

  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        reducedMotion: "reduce", // freeze reveal animations for stable measurement
      });
      const page = await context.newPage();
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      // Wait for fonts to be applied so widths are stable.
      await page.evaluate(() => document.fonts?.ready);
      await page.waitForSelector('[aria-label="Fitness Is The Only Law"]');

      const raw = await measure(page);
      const sample = normalize(raw);
      results[vp.name] = sample;

      const h1 = page.locator('[aria-label="Fitness Is The Only Law"]');
      await h1.screenshot({ path: `${SHOT_DIR}/${vp.name}.png` });

      await context.close();
    }
  } finally {
    await browser.close();
  }

  if (UPDATE || !existsSync(BASELINE_PATH)) {
    writeFileSync(BASELINE_PATH, JSON.stringify(results, null, 2) + "\n");
    console.log(`✔ Baseline written to ${BASELINE_PATH} (${VIEWPORTS.length} viewports).`);
    return;
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  for (const vp of VIEWPORTS) {
    const b = baseline[vp.name];
    const a = results[vp.name];
    if (!b) {
      problems.push(`${vp.name}: no baseline entry — run with UPDATE_BASELINE=1`);
      continue;
    }
    problems.push(...diff(a, b, vp.name));
  }

  if (problems.length) {
    console.error("✘ Visual regression detected:");
    for (const p of problems) console.error("  - " + p);
    console.error(`\nScreenshots: ${SHOT_DIR}/  •  If intentional, re-run with UPDATE_BASELINE=1.`);
    process.exit(1);
  }
  console.log(`✔ Hero headline matches baseline across ${VIEWPORTS.length} viewports.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});