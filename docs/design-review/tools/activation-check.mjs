// Repository activation check (task 20.4, defect 6). Real Input.dispatchMouseEvent /
// dispatchTouchEvent in headless Chrome over CDP. Exits non-zero on any failure.
//   node docs/design-review/tools/activation-check.mjs [--base http://localhost:3000]
//        [--places sky,ground,crypt,gate] [--pointers mouse,touch]
// Needs a running dev server. Built-ins plus ./cdp.mjs and ./activation-lib.mjs.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { connectToPage } from "./cdp.mjs";
import { PLACES, VIEWPORTS, casesFor, exitCodeFor, formatTable, judge } from "./activation-lib.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find(existsSync);

async function launch() {
  const profile = mkdtempSync(join(tmpdir(), "gv-activation-"));
  const port = 9300 + Math.floor(Math.random() * 300);
  const proc = spawn(
    CHROME,
    ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "about:blank"],
    { stdio: "ignore" },
  );
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break;
    } catch {}
    await sleep(250);
  }
  const cdp = await connectToPage(port);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  return {
    cdp,
    close: async () => {
      cdp.close();
      proc.kill();
      await sleep(500);
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {}
    },
  };
}

const LIST = `(() => {
  const out = [];
  document.querySelectorAll('button[aria-label][aria-pressed]').forEach((b) => {
    const li = b.closest("[data-name]"); const name = li ? li.getAttribute("data-name") : null; if (!name) return;
    const r = b.getBoundingClientRect();
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    if (r.width < 8 || cx < 4 || cx > innerWidth - 4 || cy < 4 || cy > innerHeight - 4) return;
    const t = document.elementFromPoint(cx, cy);
    if (!t || t.closest("button[aria-label][aria-pressed]") !== b) return; // covered by chrome: not a fair target
    out.push({ name, cx, cy, hw: r.width / 2 });
  });
  return out;
})()`;
const STATE = `({ dialog: !!document.querySelector('[data-testid="detail-overlay"]'), search: location.search })`;
// Nudge the world scroller and resolve in its scroll event, returning fresh creature positions.
const SCROLL_THEN_LIST = `new Promise((res) => {
  const s = document.querySelector('[data-world-scroller]');
  const max = s.scrollHeight - s.clientHeight;
  const next = s.scrollTop + 40 <= max ? s.scrollTop + 40 : Math.max(0, s.scrollTop - 40);
  s.addEventListener('scroll', () => res(${LIST}), { once: true });
  s.scrollTop = next;
  setTimeout(() => res(${LIST}), 400);
})`;

const HIT_RECORDER = `(() => {
  window.__hits = [];
  if (window.__hitRec) return;
  window.__hitRec = true;
  for (const type of ["pointerdown", "click"]) document.addEventListener(type, (e) => {
    const li = e.target instanceof Element ? e.target.closest("[data-name]") : null;
    window.__hits.push({ type, name: li ? li.getAttribute("data-name") : null, pointerType: e.pointerType || "" });
  }, true);
})()`;

async function goto(cdp, url) {
  const load = cdp.once("Page.loadEventFired", 30000);
  await cdp.send("Page.navigate", { url });
  await load;
  await sleep(1800);
}
async function enterPlace(cdp, base, place) {
  await goto(cdp, `${base}/estate`);
  const ok = await cdp.evaluate(
    `(() => { const b = document.querySelector('[data-testid="estate-place-${place}"]'); if (!b) return false; b.click(); return true; })()`,
  );
  if (!ok) throw new Error("no place button " + place);
  await sleep(3800);
}
async function closeRecord(cdp) {
  for (let i = 0; i < 2; i++) {
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await sleep(700);
    if (!(await cdp.evaluate(STATE)).dialog) break;
  }
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
  await sleep(450);
}
const mouse = (cdp, type, x, y, extra = {}) =>
  cdp.send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" ? "none" : "left", clickCount: 1, ...extra });
async function click(cdp, c, preMs = 0) {
  await mouse(cdp, "mouseMoved", c.cx, c.cy);
  await sleep(preMs);
  await mouse(cdp, "mousePressed", c.cx, c.cy, { buttons: 1 });
  await sleep(40);
  await mouse(cdp, "mouseReleased", c.cx, c.cy, { buttons: 0 });
}
async function tap(cdp, c) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c.cx, y: c.cy }] });
  await sleep(60);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
async function key(cdp, name, k) {
  await cdp.evaluate(`document.querySelector('[data-name="${name}"] button[aria-pressed]').focus()`);
  const code = k === "Enter" ? "Enter" : "Space";
  const vk = k === "Enter" ? 13 : 32;
  const text = k === "Enter" ? "\r" : " ";
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk, text });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk });
}
async function list(cdp) {
  return cdp.evaluate(LIST);
}

async function runCase(cdp, base, place, c, hasScroller) {
  if (hasScroller) {
    await cdp.evaluate(`(() => { const s = document.querySelector('[data-world-scroller]'); if (s) s.scrollTop = 0; })()`);
    await sleep(500);
  }
  let cs = await list(cdp);
  if (!cs.length) throw new Error(`no reachable creature in ${place}`);
  let target = cs[0];
  const settle = () => sleep(800);
  // Record where presses and clicks really landed, so a miss is never read as "suppressed".
  await cdp.evaluate(HIT_RECORDER);
  switch (c.id) {
    case "mouse-scroll-0":
    case "mouse-scroll-30":
    case "mouse-scroll-60":
    case "mouse-scroll-100": {
      cs = await cdp.evaluate(SCROLL_THEN_LIST);
      if (!cs.length) throw new Error("no creature after scroll");
      await sleep(c.gapMs);
      // Creatures drift; re-hit-test just before pressing so the press lands on one
      // (costs a few ms, so the real gap is gapMs plus one round trip).
      const fresh = (await list(cdp)).find((x) => x.name === cs[0].name) ?? (await list(cdp))[0];
      if (!fresh) throw new Error("no creature reachable after scroll");
      await click(cdp, fresh);
      break;
    }
    case "mouse-click":
      await click(cdp, target);
      break;
    case "mouse-hover-then-click":
      await click(cdp, target, 500);
      break;
    case "mouse-drag-12px": {
      const dx = Math.min(12, target.hw - 4);
      await mouse(cdp, "mouseMoved", target.cx - dx, target.cy);
      await mouse(cdp, "mousePressed", target.cx - dx, target.cy, { buttons: 1 });
      await mouse(cdp, "mouseMoved", target.cx, target.cy, { buttons: 1 });
      await mouse(cdp, "mouseMoved", target.cx + dx, target.cy, { buttons: 1 });
      await mouse(cdp, "mouseReleased", target.cx + dx, target.cy, { buttons: 0 });
      break;
    }
    case "key-enter":
      await key(cdp, target.name, "Enter");
      break;
    case "key-space":
      await key(cdp, target.name, "Space");
      break;
    case "close-escape": {
      await click(cdp, target);
      await settle();
      const open = (await cdp.evaluate(STATE)).dialog;
      await closeRecord(cdp);
      const closed = !(await cdp.evaluate(STATE)).dialog;
      return open && closed; // true only when it opened and then closed
    }
    case "deep-link": {
      await click(cdp, target);
      await settle();
      const search = (await cdp.evaluate(STATE)).search;
      if (!/repo=/.test(search)) return false;
      await goto(cdp, `${base}/estate${search}`); // fresh load of the shared URL
      await sleep(1200);
      return (await cdp.evaluate(STATE)).dialog;
    }
    case "touch-tap":
      await tap(cdp, target);
      break;
    case "touch-tap-after-settle":
      cs = await cdp.evaluate(SCROLL_THEN_LIST);
      await sleep(600);
      cs = await list(cdp);
      await tap(cdp, cs[0]);
      break;
    case "touch-tap-during-momentum": {
      cs = await cdp.evaluate(SCROLL_THEN_LIST);
      await sleep(20);
      const fresh = (await list(cdp))[0];
      if (!fresh) throw new Error("no creature reachable after scroll");
      await tap(cdp, fresh);
      break;
    }
    case "touch-drag-30px":
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: target.cx, y: target.cy }] });
      for (let i = 1; i <= 6; i++) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: target.cx, y: target.cy - i * 5 }] });
        await sleep(16);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      break;
    default:
      throw new Error("unknown case " + c.id);
  }
  // Poll up to 2 s: a record opens when the overlay mounts; a suppressed one never does.
  const t0 = Date.now();
  while (Date.now() - t0 < 2000) {
    if ((await cdp.evaluate(STATE)).dialog) return true;
    await sleep(50);
  }
  const hits = await cdp.evaluate("window.__hits");
  if (process.env.TRACE_ACT) console.error(c.id, "not opened; events:", JSON.stringify(hits));
  // A press that missed every creature proves nothing about suppression.
  if (!hits.some((h) => h.type === "pointerdown" && h.name)) {
    throw new Error(`press missed the creature: ${JSON.stringify(hits)}`);
  }
  return false;
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (n, d) => {
    const i = argv.indexOf("--" + n);
    return i >= 0 ? argv[i + 1] : d;
  };
  const base = arg("base", "http://localhost:3000").replace(/\/$/, "");
  const places = arg("places", PLACES.join(",")).split(",");
  const pointers = arg("pointers", "mouse,touch").split(",");
  const rows = [];
  const { cdp, close } = await launch();
  try {
    for (const pointer of pointers) {
      const vp = VIEWPORTS[pointer];
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile });
      await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: vp.mobile });
      for (const place of places) {
        await enterPlace(cdp, base, place);
        const hasScroller = await cdp.evaluate(`!!document.querySelector('[data-world-scroller]')`);
        for (const c of casesFor(pointer, hasScroller)) {
          let observed;
          try {
            observed = await runCase(cdp, base, place, c, hasScroller);
          } catch (e) {
            console.error(`ERROR ${place} ${c.id}: ${e.message}`);
            observed = !c.expectOpen;
          }
          rows.push({ place, viewport: `${vp.width}x${vp.height}`, ...judge(c, observed) });
          if ((await cdp.evaluate(STATE)).dialog) await closeRecord(cdp);
          if (c.id === "deep-link") await enterPlace(cdp, base, place);
        }
      }
    }
  } finally {
    await close();
  }
  console.log(formatTable(rows));
  const code = exitCodeFor(rows);
  console.log(code === 0 ? "\nALL PASS" : "\nFAILURES: " + rows.filter((r) => !r.pass).length);
  process.exit(code);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(3);
  });
}
