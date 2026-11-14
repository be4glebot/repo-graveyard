// Real-browser layout overlap check (task 20.2). Built-ins plus ./cdp.mjs.
// Usage:
//   node docs/design-review/tools/overlap-check.mjs [--base http://localhost:3000]
//        [--places hub,gate,sky,ground,crypt] [--sizes 1280x720,1440x900,737x720,700x720,390x844,360x740]
//        [--shots docs/design-review/repair --tag after-layout]
// Opens /estate, enters each place, and asserts that the chrome rects (header,
// return button, heading, filters, legend, sample-estate notice, pager,
// whisper, place plates) do not intersect. Exits 1 on any overlap.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connectToPage } from "./cdp.mjs";

/**
 * Intersection of two rects ({x, y, w, h}). Returns null when they only touch
 * or are apart; otherwise the overlapping width and height.
 * @param {{x:number,y:number,w:number,h:number}} a
 * @param {{x:number,y:number,w:number,h:number}} b
 * @param {number} [tolerance] overlaps at or below this many px are ignored
 */
export function rectOverlap(a, b, tolerance = 0.5) {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (!(ox > tolerance) || !(oy > tolerance)) return null;
  return { w: ox, h: oy, area: ox * oy };
}

/**
 * All overlapping pairs among named rects. Entries flagged `nested` with the
 * same `group` as another are skipped (a parent and its own child).
 * @param {{name:string,x:number,y:number,w:number,h:number,skipWith?:string[]}[]} items
 */
export function findOverlaps(items, tolerance = 0.5) {
  const out = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.skipWith?.includes(b.name) || b.skipWith?.includes(a.name)) continue;
      const o = rectOverlap(a, b, tolerance);
      if (o) out.push({ a: a.name, b: b.name, w: +o.w.toFixed(1), h: +o.h.toFixed(1) });
    }
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** In-page collector: visible named rects. Nested pairs are skipped by DOM containment. */
const COLLECT = `(() => {
  const out = [];
  const els = [];
  const add = (name, el) => {
    if (!el) return;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return;
    out.push({ name, x: r.x, y: r.y, w: r.width, h: r.height });
    els.push(el);
  };
  const q = (s) => document.querySelector(s);
  const hdr = q('[data-testid="scene-header"]');
  if (hdr) {
    add("header", hdr);
    hdr.querySelectorAll("button, h1, form, [data-testid='summary-line']").forEach((e, i) =>
      add("header." + (e.tagName.toLowerCase()) + i, e));
  }
  add("return", q('[data-testid="return-to-gate"]'));
  add("heading", q('[data-testid="place-heading"]'));
  add("chips", q('[data-testid="filter-chips"]'));
  add("legend", q('[data-testid="scene-footer-legend"]'));
  add("notice", q('[data-testid="scene-footer-plaque"]'));
  add("pager", q('[data-testid="pager"]'));
  add("whisper", q('[data-testid="scene-whisper"]'));
  ["gate", "sky", "ground", "crypt"].forEach((p) => add("plate:" + p, q('[data-testid="estate-place-' + p + '-plaque"]')));
  // Mark pairs where one element contains the other.
  const skip = [];
  for (let i = 0; i < els.length; i++) for (let j = 0; j < els.length; j++)
    if (i !== j && els[i].contains(els[j])) skip.push([out[i].name, out[j].name]);
  return JSON.stringify({ items: out, skip });
})()`;

export async function measure(cdp) {
  const raw = await cdp.evaluate(COLLECT);
  const { items, skip } = JSON.parse(raw);
  for (const [outer, inner] of skip) {
    const it = items.find((x) => x.name === outer);
    (it.skipWith ??= []).push(inner);
  }
  return { items, overlaps: findOverlaps(items) };
}

async function main() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[i + 1]?.startsWith("--") ? true : argv[++i];
  }
  const BASE = String(args.base || "http://localhost:3000").replace(/\/$/, "");
  const places = String(args.places || "hub,gate,sky,ground,crypt").split(",");
  const sizes = String(args.sizes || "1280x720,1440x900,737x720,700x720,390x844,360x740")
    .split(",")
    .map((s) => s.split("x").map(Number));
  const shotDir = args.shots ? resolve(String(args.shots)) : null;
  const tag = String(args.tag || "after-layout");
  if (shotDir) mkdirSync(shotDir, { recursive: true });

  const chrome = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find(existsSync);
  if (!chrome) throw new Error("No Chrome/Edge found");
  const profile = mkdtempSync(join(tmpdir(), "gv-overlap-"));
  const port = 9300 + Math.floor(Math.random() * 300);
  const proc = spawn(chrome, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {}
    await sleep(250);
  }
  const cdp = await connectToPage(port);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  let failures = 0;
  try {
    for (const [w, h] of sizes) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      for (const place of places) {
        const load = cdp.once("Page.loadEventFired", 30000);
        await cdp.send("Page.navigate", { url: `${BASE}/estate` });
        await load;
        await sleep(1800);
        if (place !== "hub") {
          const ok = await cdp.evaluate(`(() => { const b = document.querySelector('[data-testid="estate-place-${place}"]'); if (!b) return false; b.click(); return true; })()`);
          if (!ok) { console.log(`FAIL ${place} ${w}x${h}: no place button`); failures++; continue; }
          await sleep(3800);
        }
        const { overlaps } = await measure(cdp);
        if (shotDir) {
          const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
          writeFileSync(join(shotDir, `${tag}-${place}-${w}x${h}.png`), Buffer.from(data, "base64"));
        }
        if (overlaps.length) {
          failures++;
          console.log(`FAIL ${place} ${w}x${h}`);
          for (const o of overlaps) console.log(`  ${o.a} x ${o.b}: ${o.w} x ${o.h}`);
        } else {
          console.log(`ok   ${place} ${w}x${h}`);
        }
      }
    }
  } finally {
    cdp.close();
    proc.kill();
    await sleep(500);
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }
  if (failures) {
    console.log(`${failures} case(s) with overlap`);
    process.exit(1);
  }
  console.log("no overlaps");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
