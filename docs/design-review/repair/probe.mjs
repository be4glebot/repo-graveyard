// Phase-1 investigation probe (task 20.1). Read-only: drives headless Chrome over CDP.
// Built-ins plus ../tools/cdp.mjs. Usage:
//   node docs/design-review/repair/probe.mjs <mode> --base http://localhost:3000 --tag new [--out file.json]
// modes: layout | hub | scroll | crypt | click | touch | hovercover
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { connectToPage } from "../tools/cdp.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = {};
const argv = process.argv.slice(2);
const mode = argv[0];
for (let i = 1; i < argv.length; i++) if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[i + 1]?.startsWith("--") ? true : argv[++i];
const BASE = (args.base || "http://localhost:3000").replace(/\/$/, "");
const TAG = args.tag || "new";
const OUT = resolve("docs/design-review/repair");
mkdirSync(OUT, { recursive: true });

const CHROME = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);

export async function launch() {
  const profile = mkdtempSync(join(tmpdir(), "gv-probe-"));
  const port = 9600 + Math.floor(Math.random() * 300);
  const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {}
    await sleep(250);
  }
  const cdp = await connectToPage(port);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  return { cdp, close: async () => { cdp.close(); proc.kill(); await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch {} } };
}

async function viewport(cdp, w, h, mobile = false) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
}
async function shot(cdp, name) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, name), Buffer.from(data, "base64"));
  return name;
}
async function goto(cdp, url) {
  const load = cdp.once("Page.loadEventFired", 30000);
  await cdp.send("Page.navigate", { url });
  await load;
  await sleep(1800);
}
async function enterPlace(cdp, place, w = 1280) {
  if (args.case && place !== 'gate') { await goto(cdp, `${BASE}/dev/review?place=${place}&case=${args.case}`); await sleep(800); return; }
  await goto(cdp, `${BASE}/estate`);
  const ok = await cdp.evaluate(`(() => { const b = document.querySelector('[data-testid="estate-place-${place}"]'); if (!b) return false; b.click(); return true; })()`);
  if (!ok) throw new Error("no place button " + place);
  await sleep(3800);
}

// In-page helper source: named rects + pairwise overlaps.
const MEASURE = `(() => {
  const vis = (r) => r.width > 1 && r.height > 1;
  const R = (el) => { const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), r: +r.right.toFixed(1), b: +r.bottom.toFixed(1) }; };
  const named = [];
  const add = (name, el) => { if (!el) return; const r = R(el); if (r.w > 1 && r.h > 1 && getComputedStyle(el).visibility !== "hidden") named.push({ name, el, ...r }); };
  const q = (s) => document.querySelector(s);
  const hdr = q('[data-testid="scene-header"]');
  if (hdr) {
    add("header", hdr);
    Array.from(hdr.children).forEach((c, i) => add("header.child" + i, c));
    add("header.h1", hdr.querySelector("h1"));
    add("header.summary", hdr.querySelector('[data-testid="summary-line"]') || hdr.querySelector('[role="status"]'));
    add("header.form", hdr.querySelector("form"));
    hdr.querySelectorAll("button").forEach((b, i) => add("header.btn:" + (b.textContent || "").trim().slice(0, 14), b));
  }
  add("return", q('[data-testid="return-to-gate"]'));
  add("heading", q('[data-testid="place-heading"]'));
  add("chips", q('[data-testid="filter-chips"]'));
  add("pager", q('[data-testid="pager"]'));
  add("legend", q('[data-testid="scene-footer-legend"]'));
  add("plaque", q('[data-testid="scene-footer-plaque"]'));
  add("depth-marker", q('[data-testid="depth-marker"]'));
  const pairs = [];
  const skip = (a, b) => a.el.contains(b.el) || b.el.contains(a.el);
  for (let i = 0; i < named.length; i++) for (let j = i + 1; j < named.length; j++) {
    const a = named[i], b = named[j];
    if (skip(a, b)) continue;
    const ox = Math.min(a.r, b.r) - Math.max(a.x, b.x);
    const oy = Math.min(a.b, b.b) - Math.max(a.y, b.y);
    if (ox > 0.5 && oy > 0.5) pairs.push({ a: a.name, b: b.name, overlapW: +ox.toFixed(1), overlapH: +oy.toFixed(1), area: Math.round(ox * oy) });
  }
  return { vw: innerWidth, vh: innerHeight, docScrollW: document.documentElement.scrollWidth, named: named.map(({ el, ...n }) => n), pairs };
})()`;

async function modeLayout() {
  const { cdp, close } = await launch();
  const results = [];
  try {
    const vps = [[1280, 720], [1440, 900], [737, 720], [737, 900], [390, 844], [360, 740]];
    const places = ["sky", "ground", "crypt", "gate"];
    for (const [w, h] of vps) for (const place of places) {
      await viewport(cdp, w, h, w < 600);
      await enterPlace(cdp, place, w);
      const m = await cdp.evaluate(MEASURE);
      const issues = m.pairs.filter((p) => p.a !== "header.child1" || true);
      const flag = issues.length > 0;
      if (flag) await shot(cdp, `before-${TAG}-layout-${place}-${w}x${h}.png`);
      results.push({ place, w, h, pairs: m.pairs, docScrollW: m.docScrollW, named: m.named });
      console.log(TAG, place, `${w}x${h}`, m.pairs.length ? JSON.stringify(m.pairs) : "no overlaps");
    }
  } finally { await close(); }
  writeFileSync(join(OUT, `data-${TAG}-layout.json`), JSON.stringify(results, null, 1));
}

async function modeHub() {
  const { cdp, close } = await launch();
  const out = [];
  try {
    const sizes = [[737, 720], [737, 800], [737, 900], [700, 720], [768, 720], [800, 720], [1280, 720], [1440, 900]];
    for (const [w, h] of sizes) {
      await viewport(cdp, w, h, false);
      await goto(cdp, `${BASE}/estate`);
      // whisper cycles every 20 s; sample until visible (max ~25 s)
      let sample = null;
      for (let t = 0; t < 26; t++) {
        sample = await cdp.evaluate(`(() => {
          const R = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
          const wh = Array.from(document.querySelectorAll('[role="status"]')).filter((e) => (e.textContent||"").trim().length > 0 && !e.closest('[data-testid="scene-header"]'));
          const rects = [];
          wh.forEach((e) => { const o = +getComputedStyle(e).opacity; rects.push({ name: "whisper:" + e.textContent.trim().slice(0, 40), opacity: o, ...R(e) }); });
          const els = Array.from(document.querySelectorAll('[data-testid^="estate-place-"]'));
          const items = [];
          els.forEach((p) => { items.push({ name: p.getAttribute("data-testid"), ...R(p) });
            p.querySelectorAll("*").forEach((c) => { const own = Array.from(c.childNodes).filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(" "); if (own) { const rr = document.createRange(); rr.selectNodeContents(c); const b = rr.getBoundingClientRect(); items.push({ name: p.getAttribute("data-testid") + " text:" + own.slice(0, 30), x: b.x, y: b.y, r: b.right, b: b.bottom, w: b.width, h: b.height }); } }); });
          const notice = document.querySelector('[data-testid="scene-turning-soon"]');
          if (notice) items.push({ name: "turning-soon", ...R(notice) });
          return { rects, items };
        })()`);
        if (sample.rects.some((r) => r.opacity > 0.5 && r.w > 1)) break;
        await sleep(1000);
      }
      const ov = [];
      for (const wr of sample.rects.filter((r) => r.w > 1 && r.opacity > 0.2)) for (const it of sample.items) {
        const ox = Math.min(wr.r, it.r) - Math.max(wr.x, it.x);
        const oy = Math.min(wr.b, it.b) - Math.max(wr.y, it.y);
        if (ox > 0.5 && oy > 0.5) ov.push({ whisper: wr.name, with: it.name, overlapW: +ox.toFixed(1), overlapH: +oy.toFixed(1) });
      }
      const whisperVisible = sample.rects.filter((r) => r.opacity > 0.5);
      const fn = `before-${TAG}-hub-${w}x${h}.png`;
      if (ov.length || whisperVisible.length) await shot(cdp, fn);
      out.push({ w, h, whisper: sample.rects, overlaps: ov });
      console.log(TAG, `${w}x${h}`, "whisperVisible:", whisperVisible.length, "overlaps:", JSON.stringify(ov));
    }
  } finally { await close(); }
  writeFileSync(join(OUT, `data-${TAG}-hub.json`), JSON.stringify(out, null, 1));
}

// Defect 3: nameplates/creatures passing behind fixed headings and filters while scrolling.
async function modeScroll() {
  const { cdp, close } = await launch();
  const out = [];
  try {
    for (const [w, h] of [[1280, 720], [1440, 900], [390, 844]]) for (const place of ["sky", "ground", "crypt"]) {
      await viewport(cdp, w, h, w < 600);
      await enterPlace(cdp, place, w);
      const info = await cdp.evaluate(`(() => { const s = document.querySelector('[data-world-scroller]'); return s ? { sh: s.scrollHeight, ch: s.clientHeight } : null; })()`);
      if (!info) { out.push({ place, w, h, note: "no world scroller (paged stage)" }); console.log(TAG, place, w, "no world scroller"); continue; }
      const steps = 8;
      for (let k = 0; k <= steps; k++) {
        await cdp.evaluate(`(() => { const s = document.querySelector('[data-world-scroller]'); s.scrollTop = (s.scrollHeight - s.clientHeight) * ${k / steps}; })()`);
        await sleep(450);
        const m = await cdp.evaluate(`(() => {
          const R = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom }; };
          const ch = [];
          [["return", '[data-testid="return-to-gate"]'], ["heading", '[data-testid="place-heading"]'], ["chips", '[data-testid="filter-chips"]'], ["header", '[data-testid="scene-header"]'], ["pager", '[data-testid="pager"]']].forEach(([n, s]) => { const e = document.querySelector(s); if (e) { const r = R(e); if (r.r - r.x > 1) ch.push({ n, ...r }); } });
          const hits = [];
          document.querySelectorAll('[data-testid="scatter-plaque"], [data-testid="scatter-creature"] button').forEach((e) => {
            const r = R(e); const li = e.closest('[data-testid="scatter-creature"]'); const nm = li ? li.getAttribute("data-name") : "?";
            const lbl = e.getAttribute("data-testid") === "scatter-plaque" ? "plaque" : "sprite";
            ch.forEach((c) => { const ox = Math.min(c.r, r.r) - Math.max(c.x, r.x), oy = Math.min(c.b, r.b) - Math.max(c.y, r.y); if (ox > 1 && oy > 1) hits.push({ chrome: c.n, el: lbl, creature: nm, ox: Math.round(ox), oy: Math.round(oy) }); });
          });
          return hits;
        })()`);
        const plaqueHits = m.filter((x) => x.el === "plaque");
        if (plaqueHits.length && (k === 2 || k === 4)) await shot(cdp, `before-${TAG}-scroll-${place}-${w}x${h}-k${k}.png`);
        out.push({ place, w, h, k, plaqueHits: plaqueHits.length, spriteHits: m.length - plaqueHits.length, sample: m.slice(0, 6) });
      }
      const s = out.filter((o) => o.place === place && o.w === w);
      console.log(TAG, place, `${w}x${h}`, "steps with plaque-under-chrome:", s.filter((x) => x.plaqueHits).length, "/", s.length);
    }
  } finally { await close(); }
  writeFileSync(join(OUT, `data-${TAG}-scroll.json`), JSON.stringify(out, null, 1));
}

// Defect 4: crypt hard horizontal join + coffin grounding. Row-to-row luminance jump scan.
async function modeCrypt() {
  const { cdp, close } = await launch();
  const out = [];
  const scan = (b64) => `(async () => {
    const img = new Image(); img.src = "data:image/png;base64," + ${JSON.stringify(b64)}; await img.decode();
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data;
    const W = c.width, H = c.height; const rowL = [];
    for (let y = 0; y < H; y++) { let s = 0; for (let x = 0; x < W; x += 2) { const i = (y * W + x) * 4; s += 0.2126 * d[i] + 0.7152 * d[i+1] + 0.0722 * d[i+2]; } rowL.push(s / Math.ceil(W / 2)); }
    // Per-column-consistent step: fraction of columns whose luminance jumps > 25 across the same row pair.
    const jumps = [];
    for (let y = 4; y < H - 4; y++) {
      let n = 0, tot = 0;
      for (let x = 0; x < W; x += 4) { const a = (((y - 3) * W + x) * 4), b = (((y + 3) * W + x) * 4); const la = 0.2126 * d[a] + 0.7152 * d[a+1] + 0.0722 * d[a+2], lb = 0.2126 * d[b] + 0.7152 * d[b+1] + 0.0722 * d[b+2]; tot++; if (Math.abs(la - lb) > 18) n++; }
      jumps.push({ y, share: n / tot, meanDiff: Math.abs(rowL[y - 3] - rowL[y + 3]) });
    }
    jumps.sort((p, q) => q.meanDiff - p.meanDiff);
    return jumps.slice(0, 3);
  })()`;
  try {
    for (const [w, h] of [[1280, 720], [1440, 900], [390, 844]]) {
      await viewport(cdp, w, h, w < 600);
      await enterPlace(cdp, "crypt", w);
      const info = await cdp.evaluate(`(() => { const s = document.querySelector('[data-world-scroller]'); return s ? { sh: s.scrollHeight, ch: s.clientHeight, bz: Array.from(document.querySelectorAll('[data-blend-zone]')).map((e) => ({ z: e.getAttribute('data-blend-zone'), y: e.getBoundingClientRect().bottom })) } : null; })()`);
      const steps = info ? 6 : 0;
      for (let k = 0; k <= steps; k++) {
        if (info) { await cdp.evaluate(`(() => { const s = document.querySelector('[data-world-scroller]'); s.scrollTop = (s.scrollHeight - s.clientHeight) * ${k / Math.max(1, steps)}; })()`); await sleep(500); }
        // hide chrome+creatures so only the background is scanned
        await cdp.evaluate(`(() => { let s = document.getElementById("__hide"); if (!s) { s = document.createElement("style"); s.id = "__hide"; s.textContent = '[data-testid=world-chrome-top],[data-testid=world-chrome-bottom],[data-testid=depth-marker],[data-testid=scatter-creature],[data-testid=site-header],[data-testid=scene-footer],[data-testid=depth-scatter],[data-testid=scatter-plaque],nextjs-portal{visibility:hidden !important}'; document.head.appendChild(s); } })()`);
        await sleep(120);
        const clean = (await cdp.send("Page.captureScreenshot", { format: "png" })).data;
        await cdp.evaluate(`document.getElementById("__hide")?.remove()`);
        const top = await cdp.evaluate(scan(clean));
        await sleep(100);
        if (k % 2 === 0) await shot(cdp, `before-${TAG}-crypt-${w}x${h}-k${k}.png`);
        out.push({ w, h, k, scroller: !!info, blendZones: info?.bz, top });
        console.log(TAG, "crypt", `${w}x${h}`, "k" + k, "top row jumps:", JSON.stringify(top.map((t) => ({ y: t.y, mean: +t.meanDiff.toFixed(1), share: +t.share.toFixed(2) }))));
      }
    }
  } finally { await close(); }
  writeFileSync(join(OUT, `data-${TAG}-crypt.json`), JSON.stringify(out, null, 1));
}

// Defect 6.
const CREATURE_HIT = `((cx, cy, name) => {
  const els = document.elementsFromPoint(cx, cy);
  const top = els[0];
  const btn = top ? top.closest("button[aria-label]") : null;
  const li = btn ? btn.closest("[data-name]") : null;
  const hitName = li ? li.getAttribute("data-name") : null;
  const desc = top ? top.tagName.toLowerCase() + (top.getAttribute("data-testid") ? "[" + top.getAttribute("data-testid") + "]" : "") + (top.id ? "#" + top.id : "") + "." + String(top.className && top.className.baseVal === undefined ? top.className : "").slice(0, 50) : null;
  return { hitName, ok: hitName === name, blocker: hitName === name ? null : desc };
})`;

const LIST_CREATURES = `(() => {
  const out = [];
  document.querySelectorAll('button[aria-label][aria-pressed]').forEach((b) => {
    const li = b.closest("[data-name]"); const name = li ? li.getAttribute("data-name") : null; if (!name) return;
    const r = b.getBoundingClientRect();
    const cx = r.x + r.width / 2, cy = r.y + r.height * 0.5;
    if (cx < 0 || cx > innerWidth || cy < 0 || cy > innerHeight) return;
    out.push({ name, cx, cy, w: r.width, h: r.height, label: b.getAttribute("aria-label") });
  });
  return out;
})()`;

const STATE = `(() => ({ dialog: !!document.querySelector('[data-testid="detail-overlay"]'), card: Array.from(document.querySelectorAll('[id^="hover-card-"]')).map((e) => ({ id: e.id, role: e.getAttribute("role"), pe: getComputedStyle(e).pointerEvents, r: (() => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom }; })() })), url: location.search }))()`;

async function closeDialog(cdp) {
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await sleep(700);
  const st = await cdp.evaluate(STATE);
  if (st.dialog) {
    await cdp.evaluate(`document.querySelector('[data-testid="detail-overlay"] button[aria-label*="lose" i], [data-testid="detail-overlay"] button')?.click()`);
    await sleep(700);
  }
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
  await sleep(400);
}

async function mouseClick(cdp, x, y, preMoveMs, holdMs = 40) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await sleep(preMoveMs);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await sleep(holdMs);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
}
async function tap(cdp, x, y, holdMs = 60) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await sleep(holdMs);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function clickRun(touch) {
  const { cdp, close } = await launch();
  const out = [];
  try {
    const [w, h] = touch ? [390, 844] : [1440, 900];
    for (const place of ["gate", "sky", "ground", "crypt"]) {
      await viewport(cdp, w, h, touch);
      await enterPlace(cdp, place, w);
      const hasScroller = await cdp.evaluate(`!!document.querySelector('[data-world-scroller]')`);
      let creatures = await cdp.evaluate(LIST_CREATURES);
      const names = creatures.slice(0, touch ? 5 : 7).map((c) => c.name);
      console.log(TAG, touch ? "touch" : "mouse", place, "scroller:", hasScroller, "visible creatures:", creatures.length);
      // variants: [label, preMoveMs]. 0 = immediate click, 100 = before dwell(250), 500 = card open (pointer path).
      const variants = touch ? [["tap", 0]] : [["instant", 0], ["pre100", 100], ["pre500", 500]];
      for (const name of names) for (const [label, pre] of variants) {
        creatures = await cdp.evaluate(LIST_CREATURES);
        const c = creatures.find((x) => x.name === name);
        if (!c) { out.push({ place, name, label, note: "not in viewport" }); continue; }
        const hit = await cdp.evaluate(`(${CREATURE_HIT})(${c.cx}, ${c.cy}, ${JSON.stringify(name)})`);
        if (touch) await tap(cdp, c.cx, c.cy); else await mouseClick(cdp, c.cx, c.cy, pre);
        await sleep(700);
        const st = await cdp.evaluate(STATE);
        const row = { place, name, label, hitOk: hit.ok, hitName: hit.hitName, blocker: hit.blocker, opened: st.dialog, card: st.card.length ? st.card.map((x) => x.role || "interactive") : [], url: st.url };
        out.push(row);
        if (!st.dialog) await shot(cdp, `before-${TAG}-click-${touch ? "touch" : "mouse"}-${place}-${name}-${label}.png`).catch(() => {});
        if (st.dialog) await closeDialog(cdp); else { await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 }); await sleep(450); }
      }
      // After-scroll click (world scroller only): tap within 60 ms vs 400 ms of a scroll event.
      if (hasScroller && !touch) {
        for (const delay of [60, 400]) {
          await cdp.evaluate(`(() => { const s = document.querySelector('[data-world-scroller]'); s.scrollTop = 0; })()`);
          await sleep(500);
          await cdp.evaluate(`(() => { const s = document.querySelector('[data-world-scroller]'); s.scrollTop = Math.min(s.scrollHeight - s.clientHeight, 260); })()`);
          await sleep(delay);
          creatures = await cdp.evaluate(LIST_CREATURES);
          const c = creatures[0];
          if (!c) continue;
          await mouseClick(cdp, c.cx, c.cy, 0);
          await sleep(700);
          const st = await cdp.evaluate(STATE);
          out.push({ place, name: c.name, label: `after-scroll-${delay}ms`, opened: st.dialog });
          console.log(TAG, place, "click", delay, "ms after programmatic scroll ->", st.dialog ? "opened" : "NOT opened");
          if (st.dialog) await closeDialog(cdp);
        }
        // Drag then click (should be suppressed).
      }
      const s = out.filter((o) => o.place === place && o.label && !o.label.startsWith("after"));
      console.log(TAG, place, "opened", s.filter((x) => x.opened).length, "/", s.length, "blocked-by-other:", s.filter((x) => x.hitOk === false).length);
    }
  } finally { await close(); }
  writeFileSync(join(OUT, `data-${TAG}-click-${touch ? "touch" : "mouse"}.json`), JSON.stringify(out, null, 1));
}

// Hover card coverage: after hovering creature A for 500 ms, which other creatures' hit points sit under A's card?
async function modeHoverCover() {
  const { cdp, close } = await launch();
  const out = [];
  try {
    for (const [w, h] of [[1440, 900], [1280, 720]]) for (const place of ["gate", "sky", "ground", "crypt"]) {
      await viewport(cdp, w, h, false);
      await enterPlace(cdp, place, w);
      const creatures = await cdp.evaluate(LIST_CREATURES);
      let covered = 0, pairsTested = 0; const ex = [];
      for (const a of creatures) {
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: a.cx, y: a.cy });
        await sleep(520);
        const st = await cdp.evaluate(STATE);
        const card = st.card[0];
        if (!card) { await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 }); await sleep(300); continue; }
        for (const b of creatures) {
          if (b.name === a.name) continue;
          pairsTested++;
          if (b.cx >= card.r.x && b.cx <= card.r.r && b.cy >= card.r.y && b.cy <= card.r.b) {
            covered++;
            if (ex.length < 4) ex.push({ hover: a.name, coveredCreature: b.name, card: card.r });
          }
        }
        if (ex.length && ex.length <= 1 && covered > 0) await shot(cdp, `before-${TAG}-hovercover-${place}-${w}x${h}.png`);
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
        await sleep(350);
      }
      out.push({ place, w, h, creatures: creatures.length, pairsTested, covered, examples: ex });
      console.log(TAG, "hovercover", place, `${w}x${h}`, "creatures", creatures.length, "centers covered by another's card:", covered, "/", pairsTested);
    }
  } finally { await close(); }
  writeFileSync(join(OUT, `data-${TAG}-hovercover.json`), JSON.stringify(out, null, 1));
}


// Defect 4 detail: center each stratum boundary / blend zone in the viewport, chrome hidden, and scan +-60 rows.
async function modeCryptJoin() {
  const { cdp, close } = await launch();
  const out = [];
  try {
    for (const [w, h] of (args.sizes ? String(args.sizes).split(",").map((s) => s.split("x").map(Number)) : [[1440, 900], [1280, 720], [390, 844]])) {
      await viewport(cdp, w, h, w < 600);
      await enterPlace(cdp, "crypt", w);
      const geo = await cdp.evaluate(`(() => { const s = document.querySelector('[data-world-scroller]'); const st = s.querySelector('[data-testid="crypt-band"]').parentElement; const sr = st.getBoundingClientRect(); const y0 = sr.top + s.scrollTop; return { sh: s.scrollHeight, ch: s.clientHeight, bands: Array.from(document.querySelectorAll('[data-testid="crypt-band"]')).map((b) => { const r = b.getBoundingClientRect(); return { id: b.getAttribute('data-stratum'), top: Math.round(r.top + s.scrollTop - y0), h: Math.round(r.height) }; }), zones: Array.from(document.querySelectorAll('[data-blend-zone]')).map((z) => { const r = z.getBoundingClientRect(); return { kind: z.getAttribute('data-blend-zone'), top: Math.round(r.top + s.scrollTop - y0), h: Math.round(r.height), op: getComputedStyle(z).opacity }; }), coffins: Array.from(document.querySelectorAll('[data-testid="scatter-creature"]')).map((l) => { const r = l.getBoundingClientRect(); return { name: l.getAttribute('data-name'), top: Math.round(r.top + s.scrollTop - y0), h: Math.round(r.height) }; }) }; })()`);
      console.log(TAG, "crypt geometry", `${w}x${h}`, JSON.stringify(geo));
      const joins = [...geo.bands.slice(1).map((b) => ({ n: "band-" + b.id, y: b.top })), ...geo.zones.map((z, i) => ({ n: "zone" + i + "-" + z.kind, y: z.top + z.h / 2 }))];
      for (const j of joins) {
        await cdp.evaluate(`(() => { const s = document.querySelector('[data-world-scroller]'); const st = s.querySelector('[data-testid="crypt-band"]').parentElement; const y0 = st.getBoundingClientRect().top + s.scrollTop; s.scrollTop = y0 + ${j.y} - s.clientHeight / 2; })()`);
        await sleep(600);
        await cdp.evaluate(`(() => { let s = document.createElement("style"); s.id = "__hide"; s.textContent = '[data-testid=world-chrome-top],[data-testid=world-chrome-bottom],[data-testid=depth-marker],[data-testid=scatter-creature],[data-testid=site-header],[data-testid=scene-footer],[data-testid=world-gradient-top],[data-testid=world-gradient-bottom],nextjs-portal{visibility:hidden !important}'; document.head.appendChild(s); })()`);
        await sleep(150);
        const shotB64 = (await cdp.send("Page.captureScreenshot", { format: "png" })).data;
        const res = await cdp.evaluate(`(async () => {
          const img = new Image(); img.src = "data:image/png;base64," + ${JSON.stringify(shotB64)}; await img.decode();
          const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
          const g = c.getContext("2d"); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; const W = c.width, H = c.height;
          const L = (x, y) => { const i = (y * W + x) * 4; return 0.2126 * d[i] + 0.7152 * d[i+1] + 0.0722 * d[i+2]; };
          const rowMean = (y) => { let s = 0, n = 0; for (let x = 0; x < W; x += 2) { s += L(x, y); n++; } return s / n; };
          const mid = Math.round(H / 2); let best = { y: 0, d: 0, share: 0 };
          for (let y = mid - 70; y < mid + 70; y++) { const dm = Math.abs(rowMean(y - 2) - rowMean(y + 2)); if (dm > best.d) { let n = 0, t = 0; for (let x = 0; x < W; x += 4) { t++; if (Math.abs(L(x, y - 2) - L(x, y + 2)) > 12) n++; } best = { y, d: +dm.toFixed(1), share: +(n / t).toFixed(2) }; } }
          return best; })()`);
        await cdp.evaluate(`document.getElementById("__hide")?.remove()`);
        const fn = args.prefix ? `${args.prefix}-${w}x${h}-${j.n}.png` : `before-${TAG}-cryptjoin-${w}x${h}-${j.n}.png`;
        await shot(cdp, fn);
        out.push({ w, h, join: j, best: res, shot: fn });
        console.log(TAG, `${w}x${h}`, j.n, "y=" + Math.round(j.y), "max row step", JSON.stringify(res));
      }
    }
  } finally { await close(); }
  writeFileSync(join(OUT, `data-${TAG}-cryptjoin.json`), JSON.stringify(out, null, 1));
}
const modes = { cryptjoin: modeCryptJoin, layout: modeLayout, hub: modeHub, scroll: modeScroll, crypt: modeCrypt, click: () => clickRun(false), touch: () => clickRun(true), hovercover: modeHoverCover };



// Defect 6 extra: which parts of each creature button are reachable (not covered by chrome / other elements)?
async function modeReach() {
  const { cdp, close } = await launch();
  const out = [];
  const expr = `(() => {
    const res = [];
    document.querySelectorAll('button[aria-label][aria-pressed]').forEach((b) => {
      const li = b.closest("[data-name]"); const name = li ? li.getAttribute("data-name") : null; if (!name) return;
      const r = b.getBoundingClientRect(); let tot = 0, ok = 0, off = 0; const cover = {};
      for (let i = 0; i < 5; i++) for (let k = 0; k < 5; k++) {
        const x = r.x + r.width * (0.1 + 0.2 * i), y = r.y + r.height * (0.1 + 0.2 * k);
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) { off++; continue; }
        tot++;
        const t = document.elementFromPoint(x, y); const hb = t ? t.closest("button[aria-label][aria-pressed]") : null;
        if (hb === b) ok++; else { const d = t ? (t.closest("[data-testid]")?.getAttribute("data-testid") || t.tagName.toLowerCase()) + (hb ? "(other creature " + hb.closest("[data-name]")?.getAttribute("data-name") + ")" : "") : "none"; cover[d] = (cover[d] || 0) + 1; }
      }
      if (tot > 0 && ok < tot) res.push({ name, inView: tot, reachable: ok, cover, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } });
    });
    return res; })()`;
  try {
    for (const [w, h] of [[1440, 900], [1280, 720], [390, 844]]) for (const place of ["gate", "sky", "ground", "crypt"]) {
      await viewport(cdp, w, h, w < 600);
      await enterPlace(cdp, place, w);
      const steps = (await cdp.evaluate(`!!document.querySelector('[data-world-scroller]')`)) ? 8 : 0;
      const agg = {};
      for (let k = 0; k <= steps; k++) {
        if (steps) { await cdp.evaluate(`(() => { const s = document.querySelector('[data-world-scroller]'); s.scrollTop = (s.scrollHeight - s.clientHeight) * ${k / steps}; })()`); await sleep(400); }
        const r = await cdp.evaluate(expr);
        for (const e of r) { const key = e.name; agg[key] = agg[key] || { worst: 1, covers: {} }; agg[key].worst = Math.min(agg[key].worst, e.reachable / e.inView); for (const c of Object.keys(e.cover)) agg[key].covers[c] = (agg[key].covers[c] || 0) + e.cover[c]; }
        if (r.length && k === Math.round(steps / 2)) await shot(cdp, `before-${TAG}-reach-${place}-${w}x${h}.png`);
      }
      out.push({ place, w, h, steps, partiallyCovered: agg });
      console.log(TAG, "reach", place, `${w}x${h}`, JSON.stringify(agg));
    }
  } finally { await close(); }
  writeFileSync(join(OUT, `data-${TAG}-reach.json`), JSON.stringify(out, null, 1));
}

// Defect 6 extra: real wheel scroll, then click a creature N ms after the last scroll event.
async function modeWheel() {
  const { cdp, close } = await launch();
  const out = [];
  try {
    await viewport(cdp, 1440, 900, false);
    for (const place of ["sky", "ground", "crypt"]) {
      for (const delay of [0, 40, 90, 140, 300]) {
        await enterPlace(cdp, place, 1440);
        // record last scroll event time in page
        await cdp.evaluate(`(() => { const s = document.querySelector('[data-world-scroller]'); window.__ls = 0; s.addEventListener('scroll', () => { window.__ls = performance.now(); }); window.__clicks = []; document.addEventListener('click', (e) => window.__clicks.push({ dt: Math.round(performance.now() - window.__ls), detail: e.detail, prevented: e.defaultPrevented }), true); })()`);
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 720, y: 450 });
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 720, y: 450, deltaX: 0, deltaY: 120 });
        // wait until the last scroll event, then the requested gap
        let last = -1; for (let i = 0; i < 40; i++) { const t = await cdp.evaluate(`window.__ls`); if (t === last && t > 0) break; last = t; await sleep(30); }
        await sleep(delay);
        const creatures = await cdp.evaluate(LIST_CREATURES);
        const c = creatures[0]; if (!c) { out.push({ place, delay, note: "no creature in view" }); continue; }
        await mouseClick(cdp, c.cx, c.cy, 0, 20);
        await sleep(700);
        const st = await cdp.evaluate(STATE);
        const clicks = await cdp.evaluate(`window.__clicks`);
        out.push({ place, delay, name: c.name, opened: st.dialog, clicks });
        console.log(TAG, place, "gap after last scroll event ~" + delay + "ms ->", st.dialog ? "opened" : "NOT opened", JSON.stringify(clicks));
        if (st.dialog) await closeDialog(cdp);
      }
    }
  } finally { await close(); }
  writeFileSync(join(OUT, `data-${TAG}-wheel.json`), JSON.stringify(out, null, 1));
}
Object.assign(modes, { reach: modeReach, wheel: modeWheel });




async function modeInspect() {
  const { cdp, close } = await launch();
  try {
    await viewport(cdp, 1440, 900, false);
    await enterPlace(cdp, "ground", 1440);
    const steps = 8; const seen = new Set();
    for (let k = 0; k <= steps; k++) {
      await cdp.evaluate(`(() => { const s = document.querySelector('[data-world-scroller]'); s.scrollTop = (s.scrollHeight - s.clientHeight) * ${k / steps}; })()`);
      await sleep(400);
      const r = await cdp.evaluate(`(() => { const res = []; document.querySelectorAll('button[aria-label][aria-pressed]').forEach((b) => { const r = b.getBoundingClientRect(); for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const x = r.x + r.width * (0.1 + 0.2 * i), y = r.y + r.height * (0.1 + 0.2 * j); if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue; const t = document.elementFromPoint(x, y); if (t && t.closest("button[aria-label][aria-pressed]") !== b) { let path = []; let e = t; for (let n = 0; e && n < 4; n++, e = e.parentElement) path.push(e.tagName.toLowerCase() + (e.getAttribute("data-testid") ? "[" + e.getAttribute("data-testid") + "]" : "") + (e.getAttribute("data-part") ? "{" + e.getAttribute("data-part") + "}" : "") + "." + String(typeof e.className === "string" ? e.className : "").slice(0, 60)); const cs = getComputedStyle(t); res.push({ creature: b.closest("[data-name]").getAttribute("data-name"), path: path.join(" < "), pe: cs.pointerEvents, z: cs.zIndex, rect: (() => { const q = t.getBoundingClientRect(); return [Math.round(q.x), Math.round(q.y), Math.round(q.width), Math.round(q.height)]; })() }); } } }); return res; })()`);
      for (const e of r) { const key = e.creature + "|" + e.path; if (!seen.has(key)) { seen.add(key); console.log("k" + k, JSON.stringify(e)); } }
    }
  } finally { await close(); }
}
Object.assign(modes, { inspect: modeInspect });

setTimeout(() => {
if (!modes[mode]) { console.error("unknown mode", mode); process.exit(1); }
modes[mode]().then(() => process.exit(0), (e) => { console.error("probe failed:", e); process.exit(1); });
}, 0);

async function modeMomentum() {
  const { cdp, close } = await launch();
  const out = [];
  try {
    await viewport(cdp, 1440, 900, false);
    for (const place of ["sky", "ground", "crypt"]) {
      await enterPlace(cdp, place, 1440);
      // 1) idle scroll events (anything nudging scrollTop while the user does nothing)?
      const idle = await cdp.evaluate(`new Promise((res) => { const s = document.querySelector('[data-world-scroller]'); let n = 0; const f = () => n++; s.addEventListener('scroll', f); setTimeout(() => { s.removeEventListener('scroll', f); res(n); }, 3000); })`);
      console.log(TAG, place, "idle scroll events in 3 s:", idle);
      out.push({ place, idle });
      // 2) click N ms after a tiny scroll (what a trackpad inertia tail looks like)
      for (const gap of [0, 30, 60, 100, 150]) {
        await enterPlace(cdp, place, 1440);
        await sleep(300);
        const c = (await cdp.evaluate(LIST_CREATURES))[0];
        if (!c) continue;
        await cdp.evaluate(`(() => { const s = document.querySelector('[data-world-scroller]'); window.__ev = []; document.addEventListener('click', (e) => window.__ev.push({ detail: e.detail, prevented: e.defaultPrevented, t: Math.round(performance.now() - window.__t) }), true); s.scrollTop = s.scrollTop + 1; window.__t = performance.now(); })()`);
        await sleep(gap);
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: c.cx, y: c.cy });
        await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: c.cx, y: c.cy, button: "left", buttons: 1, clickCount: 1 });
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: c.cx, y: c.cy, button: "left", buttons: 0, clickCount: 1 });
        await sleep(600);
        const st = await cdp.evaluate(STATE);
        const ev = await cdp.evaluate(`window.__ev`);
        console.log(TAG, place, "click", gap, "ms after a 1px scroll ->", st.dialog ? "opened" : "SWALLOWED/not opened", JSON.stringify(ev));
        out.push({ place, gap, opened: st.dialog, ev });
        if (st.dialog) await closeDialog(cdp);
      }
    }
  } finally { await close(); }
  writeFileSync(join(OUT, `data-${TAG}-momentum.json`), JSON.stringify(out, null, 1));
}
Object.assign(modes, { momentum: modeMomentum });
