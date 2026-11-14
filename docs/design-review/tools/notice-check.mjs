// Task 25.1: Hub turning-soon notice overlap check (real browser, CDP).
// Usage: node docs/design-review/tools/notice-check.mjs [--url /g/be4glebot] [--tag before|after]
//   [--sizes 1024x500,...] [--shots docs/design-review/ux-polish]
// Measures the notice rect against every Hub plaque, the sky sprites, the whisper,
// the header and the legend. Plaques/header/legend/whisper overlaps fail (exit 1);
// sprite overlap is reported only.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connectToPage } from "./cdp.mjs";
import { rectOverlap } from "./overlap-check.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const COLLECT = `(() => {
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
  const vis = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 1 && r.height > 1; };
  const q = (s) => document.querySelector(s);
  const notice = q('[data-testid="scene-turning-soon"]');
  if (!notice) return JSON.stringify({ notice: null });
  const others = [];
  const add = (name, el) => { if (el && vis(el)) others.push({ name, ...rect(el), hard: true }); };
  ["gate", "sky", "ground", "crypt"].forEach((p) => add("plaque:" + p, q('[data-testid="estate-place-' + p + '-plaque"]')));
  add("header", q('[data-testid="scene-header"]'));
  add("legend", q('[data-testid="scene-footer-legend"]'));
  add("whisper", q('[data-testid="scene-whisper"]'));
  const sky = q('[data-testid="estate-place-sky"]');
  if (sky) sky.querySelectorAll("img, [data-testid*='creature'], [data-testid*='rep']").forEach((e, i) => {
    if (vis(e) && !e.closest('[data-testid$="-plaque"]')) others.push({ name: "sprite" + i, ...rect(e), hard: false });
  });
  return JSON.stringify({ notice: rect(notice), vw: innerWidth, vh: innerHeight, others });
})()`;

export async function main() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) args[argv[i].slice(2)] = argv[i + 1];
  const BASE = "http://localhost:3000";
  const url = args.url || "/g/be4glebot";
  const tag = args.tag || "after";
  const sizes = String(args.sizes || "1024x500,1024x550,1024x768,1280x720,1440x900,737x700,600x800,390x844,360x740")
    .split(",").map((s) => s.split("x").map(Number));
  const out = resolve(args.shots || "docs/design-review/ux-polish");
  mkdirSync(out, { recursive: true });
  const chrome = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);
  const profile = mkdtempSync(join(tmpdir(), "gv-notice-"));
  const port = 9400 + Math.floor(Math.random() * 300);
  const proc = spawn(chrome, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(250); }
  const cdp = await connectToPage(port);
  await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
  let failures = 0;
  try {
    for (const [w, h] of sizes) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      const load = cdp.once("Page.loadEventFired", 40000);
      await cdp.send("Page.navigate", { url: BASE + url });
      await load;
      await sleep(6500);
      const m = JSON.parse(await cdp.evaluate(COLLECT));
      const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(out, `25-1-${tag}-${w}x${h}.png`), Buffer.from(data, "base64"));
      if (!m.notice) { console.log(`NONOTICE ${w}x${h}`); failures++; continue; }
      const bad = [], soft = [];
      for (const o of m.others) {
        const ov = rectOverlap(m.notice, o, 0.5);
        if (ov) (o.hard ? bad : soft).push(`${o.name} ${ov.w.toFixed(0)}x${ov.h.toFixed(0)}`);
      }
      const n = m.notice;
      const off = n.x < -0.5 || n.x + n.w > m.vw + 0.5 || n.y < -0.5;
      if (off) bad.push("offscreen");
      console.log(`${bad.length ? "FAIL" : "ok  "} ${w}x${h} notice=(${n.x.toFixed(0)},${n.y.toFixed(0)} ${n.w.toFixed(0)}x${n.h.toFixed(0)}) ${bad.join("; ")}${soft.length ? " [sprites: " + soft.length + "]" : ""}`);
      if (bad.length) failures++;
    }
  } finally { cdp.close(); proc.kill(); await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
  if (failures) { console.log(`${failures} failing size(s)`); process.exit(1); }
  console.log("no notice overlaps");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => { console.error(e); process.exit(2); });
}
