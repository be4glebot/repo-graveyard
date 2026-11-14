// Real-browser scroll occlusion check (task 20.3, defect 3). Built-ins plus ./cdp.mjs
// and the pure rect helpers from ./overlap-check.mjs.
// Usage:
//   node docs/design-review/tools/scroll-occlusion-check.mjs [--base http://localhost:3000]
//        [--places sky,ground,crypt] [--sizes 1280x720,1440x900,737x720,390x844,360x740]
//        [--case ghosts-12] [--shots docs/design-review/repair --tag after-occlusion] [--json out.json]
// For every place and size it enters the world, scrolls the world scroller in
// steps, and asserts at each step that
//   (a) no creature (sprite or nameplate) is still hit-testable inside any
//       visible chrome label rect (header, return, heading, chips, depth
//       marker, pager, legend, notice). Chrome is made click-through for the
//       test so `elementFromPoint` reports what is drawn beneath it, and a
//       clipped creature is not hit-testable;
//   (b) the chrome rects do not overlap each other (the depth marker stays
//       clear of the heading and chips at 360 px).
// Exits 1 on any violation.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connectToPage } from "./cdp.mjs";
import { findOverlaps } from "./overlap-check.mjs";

/**
 * Scroll offsets that walk a scroller from top to bottom in `stepPx` steps and
 * always end exactly at the bottom. Empty or non-scrollable content gives [0].
 * @param {number} scrollHeight @param {number} clientHeight @param {number} stepPx
 */
export function scrollOffsets(scrollHeight, clientHeight, stepPx) {
  const max = Math.max(0, (scrollHeight || 0) - (clientHeight || 0));
  if (!(max > 0) || !(stepPx > 0)) return [0];
  const out = [];
  for (let y = 0; y < max; y += stepPx) out.push(Math.round(y));
  out.push(Math.round(max));
  return out;
}

/**
 * Sample points covering a rect ({x, y, w, h}) on a grid, clipped to a
 * viewport. Always includes the rect centre when it is inside the viewport.
 * @param {{x:number,y:number,w:number,h:number}} r
 * @param {number} step
 * @param {{w:number,h:number}} viewport
 */
export function samplePoints(r, step, viewport) {
  const pts = [];
  const x0 = Math.max(0, r.x);
  const y0 = Math.max(0, r.y);
  const x1 = Math.min(viewport.w - 0.01, r.x + r.w);
  const y1 = Math.min(viewport.h - 0.01, r.y + r.h);
  if (!(x1 > x0) || !(y1 > y0)) return pts;
  for (let y = y0 + step / 2; y < y1; y += step) {
    for (let x = x0 + step / 2; x < x1; x += step) pts.push({ x, y });
  }
  pts.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 });
  return pts;
}

/**
 * Group raw point hits ({chrome, creature, part}) into one violation per
 * chrome label, creature and part with the number of points.
 * @param {{chrome:string,creature:string,part:string}[]} hits
 */
export function summarizeHits(hits) {
  const map = new Map();
  for (const h of hits) {
    const key = `${h.chrome}|${h.creature}|${h.part}`;
    const prev = map.get(key);
    if (prev) prev.points++;
    else map.set(key, { chrome: h.chrome, creature: h.creature, part: h.part, points: 1, ...(h.at ? { at: h.at } : {}) });
  }
  return [...map.values()];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LABELS = {
  header: '[data-testid="scene-header"]',
  return: '[data-testid="return-to-gate"]',
  heading: '[data-testid="place-heading"]',
  chips: '[data-testid="filter-chips"]',
  "depth-marker": '[data-testid="depth-marker"]',
  pager: '[data-testid="pager"]',
  legend: '[data-testid="scene-footer-legend"]',
  notice: '[data-testid="scene-footer-plaque"]',
};

const CLICK_THROUGH_CSS =
  "[data-testid=world-chrome-top] *,.world-chrome-bottom *,[data-testid=depth-marker],[data-testid=depth-marker] *,[data-testid=scene-header],[data-testid=scene-header] *,[data-testid=scene-footer] *,[data-testid=scene-footer-legend],[data-testid=scene-footer-plaque]{pointer-events:none !important}";

/** In-page: label rects and a hit-test of every sampled point against the creatures. */
const OCCLUSION = `(() => {
  const LABELS = ${JSON.stringify(LABELS)};
  const STEP = 8;
  let st = document.getElementById("__clickthrough");
  if (!st) { st = document.createElement("style"); st.id = "__clickthrough"; st.textContent = ${JSON.stringify(CLICK_THROUGH_CSS)}; document.head.appendChild(st); }
  const vw = innerWidth, vh = innerHeight;
  const rects = [];
  for (const [name, sel] of Object.entries(LABELS)) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue;
    rects.push({ name, x: r.x, y: r.y, w: r.width, h: r.height });
  }
  const hits = [];
  for (const r of rects) {
    const x0 = Math.max(0, r.x), y0 = Math.max(0, r.y), x1 = Math.min(vw - 0.01, r.x + r.w), y1 = Math.min(vh - 0.01, r.y + r.h);
    if (!(x1 > x0) || !(y1 > y0)) continue;
    const pts = [];
    for (let y = y0 + STEP / 2; y < y1; y += STEP) for (let x = x0 + STEP / 2; x < x1; x += STEP) pts.push([x, y]);
    pts.push([(x0 + x1) / 2, (y0 + y1) / 2]);
    for (const [x, y] of pts) {
      const top = document.elementFromPoint(x, y);
      const li = top ? top.closest('[data-testid="scatter-creature"]') : null;
      if (li) hits.push({ chrome: r.name, creature: li.getAttribute("data-name"), part: top.closest('[data-testid="scatter-plaque"]') ? "plaque" : "sprite", at: [Math.round(x), Math.round(y)] });
    }
  }
  return JSON.stringify({ rects, hits });
})()`;

const CLEAN = `document.getElementById("__clickthrough")?.remove()`;

export async function measureOcclusion(cdp) {
  const raw = await cdp.evaluate(OCCLUSION);
  await cdp.evaluate(CLEAN);
  const { rects, hits } = JSON.parse(raw);
  return { rects, violations: summarizeHits(hits), chromeOverlaps: findOverlaps(rects.map((r) => ({ ...r }))) };
}

async function main() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[i + 1]?.startsWith("--") ? true : argv[++i];
  }
  const BASE = String(args.base || "http://localhost:3000").replace(/\/$/, "");
  const places = String(args.places || "sky,ground,crypt").split(",");
  const sizes = String(args.sizes || "1280x720,1440x900,737x720,390x844,360x740")
    .split(",")
    .map((s) => s.split("x").map(Number));
  const shotDir = args.shots ? resolve(String(args.shots)) : null;
  const tag = String(args.tag || "after-occlusion");
  if (shotDir) mkdirSync(shotDir, { recursive: true });

  const chrome = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find(existsSync);
  if (!chrome) throw new Error("No Chrome/Edge found");
  const profile = mkdtempSync(join(tmpdir(), "gv-occlusion-"));
  const port = 9300 + Math.floor(Math.random() * 300);
  const proc = spawn(chrome, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {}
    await sleep(250);
  }
  const cdp = await connectToPage(port);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  const report = [];
  let failures = 0;
  try {
    for (const [w, h] of sizes) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      for (const place of places) {
        const load = cdp.once("Page.loadEventFired", 30000);
        const url = args.case ? `${BASE}/dev/review?place=${place}&case=${args.case}` : `${BASE}/estate`;
        await cdp.send("Page.navigate", { url });
        await load;
        await sleep(1800);
        if (!args.case) {
          const ok = await cdp.evaluate(`(() => { const b = document.querySelector('[data-testid="estate-place-${place}"]'); if (!b) return false; b.click(); return true; })()`);
          if (!ok) { console.log(`FAIL ${place} ${w}x${h}: no place button`); failures++; continue; }
          await sleep(3800);
        } else {
          await sleep(800);
        }
        const info = await cdp.evaluate(`(() => { const s = document.querySelector('[data-world-scroller]'); return s ? { sh: s.scrollHeight, ch: s.clientHeight } : null; })()`);
        if (!info) { console.log(`FAIL ${place} ${w}x${h}: no world scroller`); failures++; continue; }
        const offsets = scrollOffsets(info.sh, info.ch, Math.round(info.ch * 0.2));
        let bad = 0;
        let worst = null;
        let visibleAtTop = 0;
        const stepLog = [];
        for (let k = 0; k < offsets.length; k++) {
          await cdp.evaluate(`(() => { const s = document.querySelector('[data-world-scroller]'); s.scrollTop = ${offsets[k]}; })()`);
          await sleep(220);
          const m = await measureOcclusion(cdp);
          if (k === 0) {
            visibleAtTop = await cdp.evaluate(`document.querySelectorAll('[data-testid="scatter-creature"]').length`);
          }
          const problems = m.violations.length + m.chromeOverlaps.length;
          stepLog.push({ k, scrollTop: offsets[k], violations: m.violations, chromeOverlaps: m.chromeOverlaps, rects: m.rects });
          if (problems) {
            bad++;
            if (!worst) worst = { k, ...m };
          }
          if (shotDir && k === Math.min(2, offsets.length - 1)) {
            const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
            writeFileSync(join(shotDir, `${tag}-${place}-${w}x${h}.png`), Buffer.from(data, "base64"));
          }
        }
        report.push({ place, size: `${w}x${h}`, steps: offsets.length, badSteps: bad, creatures: visibleAtTop, stepLog });
        if (bad) {
          failures++;
          console.log(`FAIL ${place} ${w}x${h}: ${bad}/${offsets.length} steps`);
          for (const v of worst.violations.slice(0, 6)) console.log(`  step ${worst.k}: ${v.creature} (${v.part}) under ${v.chrome}: ${v.points} pts${v.at ? ` at ${v.at}` : ""}`);
          for (const o of worst.chromeOverlaps) console.log(`  step ${worst.k}: chrome ${o.a} x ${o.b}: ${o.w} x ${o.h}`);
        } else {
          console.log(`ok   ${place} ${w}x${h}: ${offsets.length} steps, ${visibleAtTop} creatures`);
        }
      }
    }
  } finally {
    cdp.close();
    proc.kill();
    await sleep(500);
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }
  if (args.json) writeFileSync(resolve(String(args.json)), JSON.stringify(report, null, 1));
  if (failures) {
    console.log(`${failures} case(s) with occlusion`);
    process.exit(1);
  }
  console.log("no occlusion");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
