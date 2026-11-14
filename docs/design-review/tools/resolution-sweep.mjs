// Task 25.3: resolution overlap sweep (real Chrome over CDP). Built-ins plus
// ./cdp.mjs and ./overlap-check.mjs (rect maths).
//
// Usage:
//   node docs/design-review/tools/resolution-sweep.mjs [--base http://localhost:3000]
//     [--pages estate,be4glebot,defunkt] [--places hub,gate,sky,ground,crypt]
//     [--matrix subset|full] [--widths 320,360,...] [--heights 480,500,...]
//     [--sizes 1024x500,390x844]      (explicit list; overrides matrix)
//     [--reload]                      (fresh navigation per size; default resizes in place)
//     [--shots docs/design-review/ux-polish --tag 25-3-before]
//     [--json out.json] [--fonts]
//
// Matrix "subset" (default): all widths at heights 500, 720, 900 plus all heights
// at widths 390, 1024, 1440. "full": every width x every height.
// For each page and place it measures pairwise overlaps among visible UI boxes
// (header parts, return button, heading, subtitle, chips, pager, legend,
// notice, whisper, plates, depth marker, creature plaques, sample-estate notice)
// and reports chrome that spills outside the viewport horizontally. Exits 1 on
// any finding.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connectToPage } from "./cdp.mjs";
import { findOverlaps } from "./overlap-check.mjs";

export const ALL_WIDTHS = [320, 360, 390, 414, 600, 700, 737, 768, 820, 1024, 1180, 1280, 1366, 1440, 1536, 1920, 2560];
export const ALL_HEIGHTS = [480, 500, 550, 600, 720, 768, 800, 900, 1080];
export const SUBSET_HEIGHTS = [500, 720, 900];
export const SUBSET_WIDTHS = [390, 1024, 1440];

/** Parse "1,2,3" into numbers, dropping anything non-positive or non-finite. */
export function parseNumList(text) {
  return String(text ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/** Parse "1024x500,390x844" into [w, h] pairs, dropping malformed entries. */
export function parseSizes(text) {
  return String(text ?? "")
    .split(",")
    .map((s) => s.trim().split("x").map(Number))
    .filter((p) => p.length === 2 && p.every((n) => Number.isFinite(n) && n > 0));
}

/**
 * Build the size matrix as unique [w, h] pairs.
 * "full": widths x heights. "subset": all widths at `SUBSET_HEIGHTS`, plus all
 * heights at `SUBSET_WIDTHS`.
 * @param {{mode?: "full"|"subset", widths?: number[], heights?: number[]}} [opts]
 */
export function buildMatrix({ mode = "subset", widths = ALL_WIDTHS, heights = ALL_HEIGHTS } = {}) {
  const seen = new Set();
  const out = [];
  const push = (w, h) => {
    const k = `${w}x${h}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push([w, h]);
    }
  };
  if (mode === "full") {
    for (const h of heights) for (const w of widths) push(w, h);
    return out;
  }
  for (const h of heights.filter((x) => SUBSET_HEIGHTS.includes(x))) for (const w of widths) push(w, h);
  for (const w of widths.filter((x) => SUBSET_WIDTHS.includes(x))) for (const h of heights) push(w, h);
  return out;
}

/** Clip a rect to the viewport; null when nothing remains (>1px each way). */
export function clipToViewport(r, vw, vh) {
  const x = Math.max(0, r.x);
  const y = Math.max(0, r.y);
  const right = Math.min(vw, r.x + r.w);
  const bottom = Math.min(vh, r.y + r.h);
  if (right - x <= 1 || bottom - y <= 1) return null;
  return { ...r, x, y, w: right - x, h: bottom - y };
}

/**
 * Chrome boxes that leave the viewport sideways by more than `tolerance` px.
 * Only names that start with one of `chromePrefixes` are considered.
 */
export function findSideSpill(items, vw, chromePrefixes, tolerance = 1) {
  const out = [];
  for (const it of items) {
    if (!chromePrefixes.some((p) => it.name.startsWith(p))) continue;
    const x = it.full?.x ?? it.x;
    const w = it.full?.w ?? it.w;
    const left = -x;
    const right = x + w - vw;
    if (left > tolerance || right > tolerance) out.push({ name: it.name, spill: +Math.max(left, right).toFixed(1) });
  }
  return out;
}

/** Collapse a flat findings list to unique "a x b" pairs with the worst size. */
export function summarizePairs(findings) {
  const map = new Map();
  for (const f of findings) {
    const key = `${f.page}|${f.place}|${[f.a, f.b].sort().join(" x ")}`;
    const area = f.w * f.h;
    const cur = map.get(key);
    if (!cur) map.set(key, { page: f.page, place: f.place, pair: [f.a, f.b].sort().join(" x "), count: 1, worst: f, worstArea: area, sizes: [f.size] });
    else {
      cur.count++;
      cur.sizes.push(f.size);
      if (area > cur.worstArea) {
        cur.worst = f;
        cur.worstArea = area;
      }
    }
  }
  return [...map.values()].sort((x, y) => y.worstArea - x.worstArea);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** In-page collector. Returns JSON: named viewport-space rects plus containment pairs. */
export const COLLECT = `(() => {
  const out = [];
  const els = [];
  const vw = innerWidth, vh = innerHeight;
  if (!document.documentElement) return JSON.stringify({ items: [], skip: [], vw, vh, sw: 0, font: null });
  const add = (name, el) => {
    if (!el) return;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    let op = 1; for (let e = el; e && e !== document.body; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity || "1");
    if (op < 0.05) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return;
    // Clip by overflow-clipping ancestors so content hidden by a scroller or
    // overflow:hidden parent is not counted as visible.
    let L = r.left, T = r.top, R = r.right, B = r.bottom;
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const pc = getComputedStyle(p);
      const clipX = pc.overflowX !== "visible", clipY = pc.overflowY !== "visible";
      if (!clipX && !clipY) continue;
      const pr = p.getBoundingClientRect();
      if (clipX) { L = Math.max(L, pr.left); R = Math.min(R, pr.right); }
      if (clipY) { T = Math.max(T, pr.top); B = Math.min(B, pr.bottom); }
    }
    // Creature tags only exist inside the world window (clip-path on
    // .world-creatures, see globals.css): clip them to it vertically.
    if (name.startsWith("tag:")) {
      const win = document.querySelector('[data-testid="depth-marker-window"]');
      if (win) { const wr = win.getBoundingClientRect(); T = Math.max(T, wr.top); B = Math.min(B, wr.bottom); }
    }
    if (R - L <= 1 || B - T <= 1) return;
    // A tag under the depth marker is cut away by the marker notch in the
    // creature clip-path (clip-path also removes hit testing). Verify with a hit
    // test at the middle of the overlap instead of assuming it.
    let notchClipped = false;
    if (name.startsWith("tag:")) {
      const mk = document.querySelector('[data-testid="depth-marker"]');
      if (mk) {
        const m = mk.getBoundingClientRect();
        const ox0 = Math.max(L, m.left), ox1 = Math.min(R, m.right), oy0 = Math.max(T, m.top), oy1 = Math.min(B, m.bottom);
        if (ox1 - ox0 > 1 && oy1 - oy0 > 1) {
          const hit = document.elementFromPoint((ox0 + ox1) / 2, (oy0 + oy1) / 2);
          notchClipped = !!(hit && !hit.closest('[data-testid="scatter-plaque"], [data-testid="scatter-creature"]'));
        }
      }
    }
    out.push({ name, x: L, y: T, w: R - L, h: B - T, full: { x: r.x, w: r.width }, notchClipped });
    els.push(el);
  };
  const q = (s) => document.querySelector(s);
  const qa = (s) => Array.from(document.querySelectorAll(s));
  const hdr = q('[data-testid="scene-header"]');
  if (hdr) {
    add("header", hdr);
    hdr.querySelectorAll("h1, button, input, [data-testid='scene-summary-line'], [data-testid='header-username-badge'], [data-testid='scene-footer-legend'], [data-testid='menu-legend']").forEach((e, i) => {
      const tid = e.getAttribute("data-testid");
      add("header." + (tid || e.tagName.toLowerCase()) + (tid ? "" : "#" + i), e);
    });
  }
  add("return", q('[data-testid="return-to-gate"]'));
  add("heading", q('[data-testid="place-heading"] h1'));
  add("subtitle", q('[data-testid="place-heading"] p'));
  // The compact chips row is a horizontal scroller whose inner row is wider than
  // the viewport by design: measure the scroller, not the inner content.
  add("chips", q('[data-testid="place-chips-row"]') || q('[data-testid="filter-chips"]'));
  add("pager", q('[data-testid="pager"]'));
  add("legend", q('[data-testid="scene-footer-legend"]'));
  add("estate-notice", q('[data-testid="scene-footer-plaque"]'));
  add("turning-notice", q('[data-testid="scene-turning-soon"]'));
  add("whisper", q('[data-testid="scene-whisper"]'));
  add("depth-marker", q('[data-testid="depth-marker"]'));
  ["gate", "sky", "ground", "crypt"].forEach((p) => add("plate:" + p, q('[data-testid="estate-place-' + p + '-plaque"]')));
  qa('[data-testid="scatter-plaque"]').forEach((e, i) => add("tag:" + (e.getAttribute("data-name") || i), e));
  const skip = [];
  for (let i = 0; i < els.length; i++) for (let j = 0; j < els.length; j++)
    if (i !== j && els[i].contains(els[j])) skip.push([out[i].name, out[j].name]);
  const h1 = q('[data-testid="scene-header"] h1');
  const font = h1 ? { family: getComputedStyle(h1).fontFamily, loaded: document.fonts.check('16px ' + getComputedStyle(h1).fontFamily.split(",")[0]), faces: Array.from(document.fonts).map(f => f.family + ":" + f.status) } : null;
  return JSON.stringify({ items: out, skip, vw, vh, sw: document.documentElement.scrollWidth, font });
})()`;

export function analyze(raw, tolerance = 1) {
  const { items, skip, vw, vh, sw, font } = JSON.parse(raw);
  const spillItems = items;
  const clipped = [];
  const names = new Set();
  for (const it of items) {
    const c = clipToViewport(it, vw, vh);
    if (c) {
      clipped.push(c);
      names.add(c.name);
    }
  }
  for (const [outer, inner] of skip) {
    const it = clipped.find((x) => x.name === outer);
    if (it) (it.skipWith ??= []).push(inner);
  }
  // Two creature plaques overlapping is a world-density matter handled by the
  // plaque resolver; keep it in the report but under its own name prefix.
  const overlaps = findOverlaps(clipped, tolerance).filter((o) => {
    const tag = clipped.find((c) => c.notchClipped && (c.name === o.a || c.name === o.b));
    return !(tag && (o.a === "depth-marker" || o.b === "depth-marker"));
  });
  const spill = findSideSpill(spillItems, vw, ["header", "return", "heading", "subtitle", "chips", "pager", "legend", "estate-notice", "turning-notice", "whisper", "plate:", "depth-marker"]);
  return { overlaps, spill, hScroll: sw > vw + 1 ? sw - vw : 0, font, vw, vh };
}

async function launch() {
  const chrome = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find(existsSync);
  if (!chrome) throw new Error("No Chrome/Edge found");
  const profile = mkdtempSync(join(tmpdir(), "gv-sweep-"));
  const port = 9500 + Math.floor(Math.random() * 300);
  const proc = spawn(chrome, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {}
    await sleep(250);
  }
  const cdp = await connectToPage(port);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  return { cdp, close: async () => { cdp.close(); proc.kill(); await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch {} } };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const k = argv[i].slice(2);
    args[k] = argv[i + 1] === undefined || argv[i + 1].startsWith("--") ? true : argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const base = String(args.base || "http://localhost:3000").replace(/\/$/, "");
  const pages = String(args.pages || "estate,be4glebot,defunkt").split(",");
  const places = String(args.places || "hub,gate,sky,ground,crypt").split(",");
  const sizes = args.sizes
    ? parseSizes(args.sizes)
    : buildMatrix({
        mode: args.matrix === "full" ? "full" : "subset",
        widths: args.widths ? parseNumList(args.widths) : ALL_WIDTHS,
        heights: args.heights ? parseNumList(args.heights) : ALL_HEIGHTS,
      });
  const shotDir = args.shots ? resolve(String(args.shots)) : null;
  const tag = String(args.tag || "25-3");
  if (shotDir) mkdirSync(shotDir, { recursive: true });
  const reload = Boolean(args.reload);
  console.log(`matrix: ${sizes.length} sizes x ${pages.length} pages x ${places.length} places (${reload ? "reload" : "resize in place"})`);

  const { cdp, close } = await launch();
  const findings = [];
  let cases = 0;
  const fontReports = [];
  const navigate = async (url, wait) => {
    const l = cdp.once("Page.loadEventFired", 60000);
    await cdp.send("Page.navigate", { url });
    await l;
    await sleep(wait);
  };
  try {
    for (const page of pages) {
      for (const place of places) {
        const path = page === "estate" ? "/estate" : `/g/${page}`;
        const url = `${base}${path}${place === "hub" ? "" : `?at=${place}`}`;
        const label = `${page}/${place}`;
        const wait = page === "estate" ? 2500 : 7000;
        let first = true;
        for (const [w, h] of sizes) {
          await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
          if (first || reload) {
            await navigate(url, wait);
            first = false;
          } else {
            await sleep(700);
          }
          let raw;
          try {
            raw = await cdp.evaluate(COLLECT);
          } catch {
            await sleep(1500); // HMR reload or navigation in flight: retry once
            raw = await cdp.evaluate(COLLECT);
          }
          const res = analyze(raw);
          cases++;
          if (args.fonts && res.font) fontReports.push({ label, size: `${w}x${h}`, ...res.font });
          const size = `${w}x${h}`;
          for (const o of res.overlaps) findings.push({ page, place, size, kind: "overlap", a: o.a, b: o.b, w: o.w, h: o.h });
          for (const s of res.spill) findings.push({ page, place, size, kind: "spill", a: s.name, b: "viewport", w: s.spill, h: 1 });
          if (res.hScroll) findings.push({ page, place, size, kind: "hscroll", a: "document", b: "viewport", w: res.hScroll, h: 1 });
          if (shotDir) {
            const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
            writeFileSync(join(shotDir, `${tag}-${page}-${place}-${size}.png`), Buffer.from(data, "base64"));
          }
          const bad = res.overlaps.length + res.spill.length + (res.hScroll ? 1 : 0);
          if (bad) console.log(`FAIL ${label} ${size}: ${[...res.overlaps.map((o) => `${o.a} x ${o.b} ${o.w}x${o.h}`), ...res.spill.map((s) => `spill ${s.name} ${s.spill}`), res.hScroll ? `hscroll ${res.hScroll}` : ""].filter(Boolean).join("; ")}`);
        }
        console.log(`done ${label}`);
      }
    }
  } finally {
    await close();
  }
  const summary = summarizePairs(findings);
  console.log(`\n${cases} case(s) measured, ${findings.length} finding(s), ${summary.length} distinct pair(s)`);
  for (const s of summary) console.log(`  ${s.page}/${s.place}: ${s.pair} x${s.count} worst ${s.worst.w}x${s.worst.h} at ${s.worst.size}`);
  if (args.fonts) console.log("fonts:", JSON.stringify(fontReports.slice(0, 3)));
  if (args.json) writeFileSync(resolve(String(args.json)), JSON.stringify({ sizes, pages, places, cases, findings, summary }, null, 2));
  process.exit(findings.length ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
