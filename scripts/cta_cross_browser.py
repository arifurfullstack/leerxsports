"""Cross-browser CTA verification: hover, focus, truncation, wrapping."""
import asyncio, json, os, sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8080")
SHOT_DIR = Path("tests/visual/screenshots/cta-cross-browser")
SHOT_DIR.mkdir(parents=True, exist_ok=True)

CTAS = [
    {"name": "primary", "text": "Enter The Platform"},
    {"name": "secondary", "text": "Explore Trainers"},
]

async def measure(page, state_label):
    return await page.evaluate("""
    (labels) => {
      const results = [];
      for (const l of labels) {
        const el = [...document.querySelectorAll('a')].find(a =>
          (a.textContent || '').trim().includes(l));
        if (!el) { results.push({label:l, error:'not found'}); continue; }
        const span = el.querySelector('span.whitespace-nowrap') || el;
        const r = el.getBoundingClientRect();
        const sr = span.getBoundingClientRect();
        const cs = getComputedStyle(span);
        results.push({
          label: l,
          buttonWidth: Math.round(r.width),
          buttonHeight: Math.round(r.height),
          labelWidth: Math.round(sr.width),
          labelClientRects: span.getClientRects().length,
          letterSpacing: cs.letterSpacing,
          wordSpacing: cs.wordSpacing,
          fontSize: cs.fontSize,
          overflow: r.right > window.innerWidth + 0.5 || r.left < -0.5,
          scrollOverflow: el.scrollWidth > el.clientWidth + 0.5,
        });
      }
      return { vw: window.innerWidth, results };
    }
    """, [c["text"] for c in CTAS])

async def run_target(p, name, launcher, ctx_opts):
    browser = await launcher.launch(headless=True)
    try:
        ctx = await browser.new_context(**ctx_opts)
        page = await ctx.new_page()
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await page.wait_for_selector('a:has-text("Enter The Platform")', timeout=10_000)
        try: await page.evaluate("document.fonts && document.fonts.ready")
        except: pass
        await page.wait_for_timeout(200)

        default = await measure(page, "default")

        # Hover primary
        primary = page.locator('a:has-text("Enter The Platform")').first
        await primary.hover()
        await page.wait_for_timeout(250)
        hover = await measure(page, "hover")
        await primary.screenshot(path=str(SHOT_DIR / f"{name}-primary-hover.png"))

        # Focus primary via keyboard (blur first by clicking away)
        await page.mouse.move(0, 0)
        await page.evaluate("document.activeElement && document.activeElement.blur()")
        await primary.focus()
        await page.wait_for_timeout(200)
        focus = await measure(page, "focus")
        await primary.screenshot(path=str(SHOT_DIR / f"{name}-primary-focus.png"))

        # Full CTA row shot
        try:
            row = page.locator('a:has-text("Enter The Platform")').locator('xpath=..')
            await row.screenshot(path=str(SHOT_DIR / f"{name}-row.png"))
        except: pass

        return {"default": default, "hover": hover, "focus": focus}
    finally:
        await browser.close()

def check(state, data):
    errs = []
    for r in data["results"]:
        if r.get("error"): errs.append(f"{state}:{r['label']} {r['error']}"); continue
        if r["labelClientRects"] != 1:
            errs.append(f"{state}:{r['label']} wraps ({r['labelClientRects']} rects)")
        if r["overflow"]:
            errs.append(f"{state}:{r['label']} overflows viewport (bw={r['buttonWidth']}, vw={data['vw']})")
        if r["scrollOverflow"]:
            errs.append(f"{state}:{r['label']} truncated (scrollWidth>clientWidth)")
        ls = float(r["letterSpacing"].replace("px",""))
        if ls < 3.5:
            errs.append(f"{state}:{r['label']} letter-spacing too small ({r['letterSpacing']})")
    return errs

async def main():
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
        failed = 0
        summary = []
        for name, launcher, opts in TARGETS:
            try:
                res = await run_target(p, name, launcher, opts)
                errs = []
                for state in ("default", "hover", "focus"):
                    errs += check(state, res[state])
                status = "PASS" if not errs else "FAIL"
                if errs: failed += 1
                brief = [{ "state": s,
                           "ctas": [{"l": r["label"][:18], "w": r["buttonWidth"],
                                     "lw": r["labelWidth"], "rects": r["labelClientRects"],
                                     "ls": r["letterSpacing"], "of": r["overflow"],
                                     "tr": r["scrollOverflow"]}
                                    for r in res[s]["results"]]}
                         for s in ("default","hover","focus")]
                print(f"[{status}] {name} vw={res['default']['vw']}")
                for b in brief:
                    print(f"   {b['state']:8} {json.dumps(b['ctas'])}")
                for e in errs: print("   -", e)
                summary.append((name, status))
            except Exception as e:
                failed += 1
                print(f"[ERROR] {name}: {e}")
                summary.append((name, "ERROR"))
        print("\n=== SUMMARY ===")
        for n, s in summary: print(f"{s:6} {n}")
        sys.exit(1 if failed else 0)

asyncio.run(main())
