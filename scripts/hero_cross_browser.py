"""Cross-browser hero headline validation (Chromium / Firefox / WebKit desktop & mobile)."""
import asyncio, json, os, sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8080")
SHOT_DIR = Path("tests/visual/screenshots/cross-browser")
SHOT_DIR.mkdir(parents=True, exist_ok=True)

INSPECT_JS = """
() => {
  const h1 = document.querySelector('[aria-label="Fitness Is The Only Law"]');
  if (!h1) return { error: "h1 not found" };
  const lines = Array.from(h1.querySelectorAll('.hero-reveal'));
  const vw = window.innerWidth;
  return {
    vw,
    lineCount: lines.length,
    lines: lines.map(el => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const clip = el.querySelector('.hero-reveal-clip') || el;
      return {
        text: (el.textContent || '').trim().slice(0, 60),
        width: Math.round(r.width),
        clientRects: el.getClientRects().length,
        overflow: r.right > vw + 0.5 || r.left < -0.5,
        letterSpacing: cs.letterSpacing,
        wordSpacing: cs.wordSpacing,
        fontSize: cs.fontSize,
        clipHasContent: (clip.textContent || '').trim().length > 0,
        clipOverflow: getComputedStyle(clip).overflow,
      };
    }),
  };
}
"""

def check(data):
    errs = []
    if data.get("error"): errs.append(data["error"]); return errs
    if data["lineCount"] != 2:
        errs.append(f"expected 2 lines, got {data['lineCount']}")
    for i, l in enumerate(data.get("lines", [])):
        if l["clientRects"] != 1:
            errs.append(f"line {i} wraps ({l['clientRects']} rects)")
        if l["overflow"]:
            errs.append(f"line {i} overflows viewport (w={l['width']}, vw={data['vw']})")
        if not l["clipHasContent"]:
            errs.append(f"line {i} clip wrapper has no text")
    return errs

async def run_target(p, name, launcher, context_opts):
    browser = await launcher.launch(headless=True)
    try:
        ctx = await browser.new_context(**context_opts)
        page = await ctx.new_page()
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await page.wait_for_selector('[aria-label="Fitness Is The Only Law"]', timeout=10_000)
        try: await page.evaluate("document.fonts && document.fonts.ready")
        except: pass
        await page.wait_for_timeout(200)
        data = await page.evaluate(INSPECT_JS)
        try:
            await page.locator('[aria-label="Fitness Is The Only Law"]').screenshot(
                path=str(SHOT_DIR / f"{name}.png"))
        except Exception: pass
        return data
    finally:
        await browser.close()

async def main():
    results = []
    async with async_playwright() as p:
        iphone14 = p.devices.get("iPhone 14") or p.devices["iPhone 13"]
        iphone_se = p.devices.get("iPhone SE") or p.devices["iPhone 8"]
        TARGETS = [
            ("chromium-desktop", p.chromium, {"viewport": {"width": 1280, "height": 900}}),
            ("firefox-desktop",  p.firefox,  {"viewport": {"width": 1280, "height": 900}}),
            ("webkit-desktop",   p.webkit,   {"viewport": {"width": 1280, "height": 900}}),
            ("webkit-iphone14",  p.webkit,   iphone14),
            ("webkit-iphone-se", p.webkit,   iphone_se),
        ]
        for name, launcher, opts in TARGETS:
            try:
                data = await run_target(p, name, launcher, opts)
                errs = check(data)
                status = "PASS" if not errs else "FAIL"
                summary = [{"w": l["width"], "rects": l["clientRects"],
                            "ls": l["letterSpacing"], "ws": l["wordSpacing"],
                            "of": l["overflow"]} for l in data.get("lines", [])]
                print(f"[{status}] {name} vw={data.get('vw')} {json.dumps(summary)}")
                for e in errs: print("   -", e)
                results.append((name, status, errs))
            except Exception as e:
                print(f"[ERROR] {name}: {e}")
                results.append((name, "ERROR", [str(e)]))
    print("\n=== SUMMARY ===")
    failed = 0
    for name, status, errs in results:
        print(f"{status:6} {name}")
        if status != "PASS": failed += 1
    sys.exit(1 if failed else 0)

asyncio.run(main())
