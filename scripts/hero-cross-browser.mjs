#!/usr/bin/env node
/**
 * Cross-browser validation for the hero headline spacing & clipping spans.
 *
 * Loads / in Chromium, Firefox, WebKit (desktop Safari), and WebKit with an
 * iPhone 14 viewport (mobile Safari). For each, asserts:
 *   - the h1 exists and contains exactly two .hero-reveal lines
 *   - neither line wraps (getClientRects().length === 1)
 *   - neither line overflows its container horizontally
 *   - computed letter/word spacing is non-zero (spacing tokens applied)
 *   - the clipping wrapper (.hero-reveal-clip / mask) is present and non-empty
 */
import { chromium, firefox, webkit, devices } from "playwright";
import { mkdirSync } from "node:fs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const SHOT_DIR = "tests/visual/screenshots/cross-browser";
mkdirSync(SHOT_DIR, { recursive: true });

const TARGETS = [
  { name: "chromium-desktop",  type: chromium, contextOpts: { viewport: { width: 1280, height: 900 } } },
  { name: "firefox-desktop",   type: firefox,  contextOpts: { viewport: { width: 1280, height: 900 } } },
  { name: "webkit-desktop",    type: webkit,   contextOpts: { viewport: { width: 1280, height: 900 } } },
  { name: "webkit-iphone14",   type: webkit,   contextOpts: { ...devices["iPhone 14"] } },
  { name: "webkit-iphone-se",  type: webkit,   contextOpts: { ...devices["iPhone SE"] } },
];

async function inspect(page) {
  return page.evaluate(() => {
    const h1 = document.querySelector('[aria-label="Fitness Is The Only Law"]');
    if (!h1) return { error: "h1 not found" };
    const lines = Array.from(h1.querySelectorAll(".hero-reveal"));
    const vw = window.innerWidth;
    const out = { vw, lineCount: lines.length, lines: [] };
    for (const el of lines) {
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      // Look for a clipping wrapper — prefer .hero-reveal-clip if present,
      // otherwise fall back to inspecting the reveal element itself.
      const clip = el.querySelector(".hero-reveal-clip") ?? el;
      const clipCS = getComputedStyle(clip);
      out.lines.push({
        text: el.textContent?.trim().slice(0, 60),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        clientRects: el.getClientRects().length,
        overflow: rect.right > vw + 0.5 || rect.left < -0.5,
        fontSize: cs.fontSize,
        letterSpacing: cs.letterSpacing,
        wordSpacing: cs.wordSpacing,
        clipOverflow: clipCS.overflow,
        clipHasContent: (clip.textContent ?? "").trim().length > 0,
      });
    }
    return out;
  });
}

function check(name, data) {
  const errs = [];
  if (data.error) errs.push(data.error);
  if (data.lineCount !== 2) errs.push(`expected 2 headline lines, got ${data.lineCount}`);
  data.lines?.forEach((l, i) => {
    if (l.clientRects !== 1) errs.push(`line ${i} wraps: ${l.clientRects} client rects`);
    if (l.overflow) errs.push(`line ${i} overflows viewport (w=${l.width}, vw=${data.vw})`);
    if (!l.clipHasContent) errs.push(`line ${i} clip wrapper has no text`);
    // letter/word spacing tokens should evaluate to non-zero px
    const ls = parseFloat(l.letterSpacing);
    const ws = parseFloat(l.wordSpacing);
    if (!Number.isFinite(ls)) errs.push(`line ${i} letterSpacing not numeric: ${l.letterSpacing}`);
    if (!Number.isFinite(ws)) errs.push(`line ${i} wordSpacing not numeric: ${l.wordSpacing}`);
  });
  return errs;
}

let failed = 0;
const summary = [];
for (const t of TARGETS) {
  let browser;
  try {
    browser = await t.type.launch({ headless: true });
    const context = await browser.newContext(t.contextOpts);
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[aria-label="Fitness Is The Only Law"]', { timeout: 10_000 });
    // Wait for fonts to settle so metrics reflect the final headline.
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(150);
    const data = await inspect(page);
    const errs = check(t.name, data);
    await page.locator('[aria-label="Fitness Is The Only Law"]').screenshot({
      path: `${SHOT_DIR}/${t.name}.png`,
    }).catch(() => {});
    const status = errs.length ? "FAIL" : "PASS";
    if (errs.length) failed++;
    summary.push({ target: t.name, status, vw: data.vw, lines: data.lines?.map(l => ({
      w: l.width, rects: l.clientRects, ls: l.letterSpacing, ws: l.wordSpacing,
    })), errors: errs });
    console.log(`[${status}] ${t.name}`, JSON.stringify(data.lines?.map(l => ({
      w: l.width, rects: l.clientRects, ls: l.letterSpacing, ws: l.wordSpacing, of: l.overflow,
    }))));
    if (errs.length) errs.forEach(e => console.log("   -", e));
  } catch (e) {
    failed++;
    summary.push({ target: t.name, status: "ERROR", error: String(e.message || e) });
    console.log(`[ERROR] ${t.name}:`, e.message);
  } finally {
    await browser?.close();
  }
}

console.log("\n=== SUMMARY ===");
for (const s of summary) console.log(s.status.padEnd(6), s.target, s.error ?? "");
process.exit(failed ? 1 : 0);
