// Polish-ground shots. Usage:
//   node docs/design-review/polish-ground/shoot.mjs <tag> [--url /g/defunkt] [--plots 1,3] [--sizes 1440x900,390x844]
// Writes <tag>-<WxH>-plot<N>-{top,scrolled}.png and <tag>-<WxH>-plot<N>-metrics.json next to this file.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { connectToPage } from "../tools/cdp.mjs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const argv = process.argv.slice(2);
const tag = argv[0];
const args = {};
for (let i = 1; i < argv.length; i++) if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[++i];
const BASE = "http://localhost:3000";
const URL_PATH = args.url || "/g/defunkt";
const plots = (args.plots || "1,3").split(",").map(Number);
const sizes = (args.sizes || "1440x900,390x844").split(",").map((s) => s.split("x").map(Number));
const OUT = resolve("docs/design-review/polish-ground");
const CHROME = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);
const profile = mkdtempSync(join(tmpdir(), "gv-pg-"));
const port = 9300 + Math.floor(Math.random() * 300);
const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", "--window-size=5200,3000", "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(250); }
const cdp = await connectToPage(port);
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
async function shot(name) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, name), Buffer.from(data, "base64"));
}
const METRICS = `(() => {
  const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
  const s = document.querySelector('[data-world-scroller]');
  const names = [...document.querySelectorAll('[data-testid="world-creature"],[data-creature],[data-testid^="creature"]')].slice(0, 40).map((e) => ({ id: e.getAttribute('data-testid'), ...r(e) }));
  return { scrollTop: s?.scrollTop, scrollH: s?.scrollHeight, clientH: s?.clientHeight, n: names.length };
})()`;
try {
  for (const [w, h] of sizes) {
    const mobile = w < 500;
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: w > 4000 ? 0.3 : w > 2000 ? 0.5 : 1, mobile });
    const load = cdp.once("Page.loadEventFired", 40000);
    await cdp.send("Page.navigate", { url: BASE + URL_PATH });
    await load;
    await sleep(2500);
    // skip the intro if present, then enter the ground
    await cdp.evaluate(`(() => { document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'})); const sk=[...document.querySelectorAll('button')].find(b=>/skip/i.test(b.textContent||'')); sk?.click(); })()`);
    await sleep(1200);
    const ok = await cdp.evaluate(`(() => { const b = document.querySelector('[data-testid="estate-place-ground"]'); if (!b) return false; b.click(); return true; })()`);
    if (!ok) { await shot(`${tag}-${w}x${h}-NOPLACE.png`); console.log("no place button at", w, h); continue; }
    await sleep(3800);
    for (const p of plots) {
      // go to plot 1 then deeper p-1 times
      for (let i = 0; i < 6; i++) await cdp.evaluate(`document.querySelector('[data-testid="pager-nearer"]:not([disabled])')?.click()`);
      await sleep(500);
      for (let i = 1; i < p; i++) { await cdp.evaluate(`document.querySelector('[data-testid="pager-deeper"]:not([disabled])')?.click()`); await sleep(900); }
      await sleep(1500);
      const label = await cdp.evaluate(`document.querySelector('[data-testid="pager-label"]')?.textContent ?? null`);
      await cdp.evaluate(`(() => { const s = document.querySelector('[data-world-scroller]'); if (s) s.scrollTo({top:0,behavior:'instant'}); })()`);
      await sleep(900);
      console.log("top scrollTop", await cdp.evaluate(`document.querySelector('[data-world-scroller]')?.scrollTop`)); await shot(`${tag}-${w}x${h}-plot${p}-top.png`);
      await cdp.evaluate(`(() => { const s = document.querySelector('[data-world-scroller]'); if (s) s.scrollTo({top:Math.round((s.scrollHeight - s.clientHeight) * 0.55),behavior:'instant'}); })()`);
      await sleep(1200);
      console.log("scrolled scrollTop", await cdp.evaluate(`document.querySelector('[data-world-scroller]')?.scrollTop`)); await shot(`${tag}-${w}x${h}-plot${p}-scrolled.png`);
      const m = await cdp.evaluate(METRICS);
      writeFileSync(join(OUT, `${tag}-${w}x${h}-plot${p}-metrics.json`), JSON.stringify({ label, ...m }, null, 1));
      console.log(w, h, "plot", p, label, JSON.stringify(m));
    }
  }
} finally {
  cdp.close(); proc.kill(); await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
