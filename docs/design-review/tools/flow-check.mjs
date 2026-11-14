// Manual-flow check (task 20.5). Real CDP input, headless Chrome. Built-ins plus ./cdp.mjs.
//   node docs/design-review/tools/flow-check.mjs [--base http://localhost:3000]
//        [--places sky,ground,crypt,gate] [--sizes 1280x720,1440x900,737x720,390x844,360x740]
// Per place and size: scroll, filter, pager, open/close a record (click+Escape, click+close button),
// deep link ?repo=, Return to the gate by click and by keyboard, re-enter another place. Exits 1 on any failure.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectToPage } from "./cdp.mjs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 ? argv[i + 1] : d; };
const BASE = arg("base", "http://localhost:3000").replace(/\/$/, "");
const PLACES = arg("places", "gate,sky,ground,crypt").split(",");
const SIZES = arg("sizes", "1280x720,1440x900,737x720,390x844,360x740").split(",");
const CHROME = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const profile = mkdtempSync(join(tmpdir(), "gv-flow-"));
const port = 9100 + Math.floor(Math.random() * 300);
const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(250); }
const cdp = await connectToPage(port);
await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
const fails = []; let passes = 0;
const check = (ok, label) => { if (ok) passes++; else { fails.push(label); console.log("FAIL", label); } };
const ev = (s) => cdp.evaluate(s);
const key = async (k, code, vk, text) => {
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk, text });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk });
};
const goto = async (url) => { const l = cdp.once("Page.loadEventFired", 30000); await cdp.send("Page.navigate", { url }); await l; await sleep(1800); };
const hubVisible = () => ev(`!!document.querySelector('[data-testid="estate-place-gate"]') && !document.querySelector('[data-testid="return-to-gate"]')`);
const enter = async (p) => { const ok = await ev(`(() => { const b = document.querySelector('[data-testid="estate-place-${p}"]'); if (!b) return false; b.click(); return true; })()`); await sleep(3800); return ok; };
const dialog = () => ev(`!!document.querySelector('[data-testid="detail-overlay"]')`);
const centre = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
const click = async (x, y) => {
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await sleep(40);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
};
const reachable = () => ev(`(() => { for (const b of document.querySelectorAll('button[aria-label][aria-pressed]')) { if (!b.closest('[data-name]')) continue; const r = b.getBoundingClientRect(); const cx = r.x + r.width/2, cy = r.y + r.height/2; if (r.width < 8 || cx < 4 || cx > innerWidth-4 || cy < 4 || cy > innerHeight-4) continue; const t = document.elementFromPoint(cx, cy); if (t && t.closest('button[aria-label][aria-pressed]') === b) return { x: cx, y: cy }; } return null; })()`);
for (const size of SIZES) {
  const [w, h] = size.split("x").map(Number);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  for (const place of PLACES) {
    const tag = `${place} ${size}`;
    try {
      await goto(`${BASE}/estate`);
      check(await enter(place), `${tag}: enter`);
      const scroller = await ev(`!!document.querySelector('[data-world-scroller]')`);
      if (scroller) {
        await ev(`(() => { const s = document.querySelector('[data-world-scroller]'); s.scrollTop = s.scrollHeight; })()`); await sleep(500);
        const st = await ev(`document.querySelector('[data-world-scroller]').scrollTop`);
        check(st > 0 || (await ev(`(() => { const s = document.querySelector('[data-world-scroller]'); return s.scrollHeight <= s.clientHeight + 1; })()`)), `${tag}: scrolls`);
        await ev(`document.querySelector('[data-world-scroller]').scrollTop = 0`); await sleep(500);
      }
      // filters
      const chips = await ev(`Array.from(document.querySelectorAll('[data-testid^="filter-chip-"]')).map((b) => b.getAttribute('data-testid'))`);
      if (chips.length > 1) {
        const id = chips[1];
        const c = await centre(`[data-testid="${id}"]`);
        const hit = await ev(`(() => { const e = document.querySelector('[data-testid="${id}"]'); const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2); return !!t && !!t.closest('[data-testid="${id}"]'); })()`);
        if (c && hit) {
          await click(c.x, c.y); await sleep(500);
          check(await ev(`document.querySelector('[data-testid="${id}"]').getAttribute('aria-pressed') === 'true'`), `${tag}: filter chip applies`);
          const a = await centre(`[data-testid="${chips[0]}"]`); await click(a.x, a.y); await sleep(500);
          check(await ev(`document.querySelector('[data-testid="${chips[0]}"]').getAttribute('aria-pressed') === 'true'`), `${tag}: filter all restores`);
        } else check(false, `${tag}: filter chip not hit-testable`);
      }
      // pager
      const pagerOn = await ev(`!!document.querySelector('[data-testid="pager-deeper"]') && !document.querySelector('[data-testid="pager-deeper"]').disabled`);
      if (pagerOn) {
        const before = await ev(`document.querySelector('[data-testid="pager-label"]')?.textContent`);
        const c = await centre('[data-testid="pager-deeper"]'); await click(c.x, c.y); await sleep(900);
        const after = await ev(`document.querySelector('[data-testid="pager-label"]')?.textContent`);
        check(before !== after, `${tag}: pager deeper changes label (${before} -> ${after})`);
        const n = await centre('[data-testid="pager-nearer"]'); await click(n.x, n.y); await sleep(900);
        check((await ev(`document.querySelector('[data-testid="pager-label"]')?.textContent`)) === before, `${tag}: pager nearer returns`);
      }
      // record: click + Escape, click + close button, deep link
      let t = await reachable();
      check(!!t, `${tag}: reachable creature`);
      if (t) {
        await click(t.x, t.y); await sleep(1000);
        check(await dialog(), `${tag}: click opens record`);
        const search = await ev(`location.search`);
        check(/repo=/.test(search), `${tag}: ?repo= pushed`);
        await key("Escape", "Escape", 27); await sleep(900);
        check(!(await dialog()), `${tag}: Escape closes`);
        t = await reachable();
        await click(t.x, t.y); await sleep(1000);
        check(await dialog(), `${tag}: reopen`);
        const cl = await centre('button[aria-label="Close record"]');
        if (cl) { await click(cl.x, cl.y); await sleep(900); }
        check(!(await dialog()), `${tag}: close button closes`);
        check(!/repo=/.test(await ev(`location.search`)), `${tag}: ?repo= cleared on close`);
        await goto(`${BASE}/estate${search}`); await sleep(1500);
        check(await dialog(), `${tag}: deep link opens record`);
        await key("Escape", "Escape", 27); await sleep(900);
        // after a fresh load the place may be rendered directly
      }
      // return: click
      await goto(`${BASE}/estate`);
      await enter(place);
      if (place !== "gate" || true) {
        const r = await centre('[data-testid="return-to-gate"]');
        if (!r) check(false, `${tag}: return button present`);
        else {
          await click(r.x, r.y); await sleep(3000);
          check(await hubVisible(), `${tag}: return (click) shows hub`);
          const other = place === "sky" ? "ground" : "sky";
          await enter(other);
          check(await ev(`!!document.querySelector('[data-testid="return-to-gate"]')`), `${tag}: hub -> ${other}`);
          // keyboard return
          await ev(`document.querySelector('[data-testid="return-to-gate"]').focus()`);
          await key("Enter", "Enter", 13, "\r"); await sleep(3000);
          check(await hubVisible(), `${tag}: return (Enter) shows hub`);
          await enter(place);
          await ev(`document.querySelector('[data-testid="return-to-gate"]').focus()`);
          await key(" ", "Space", 32, " "); await sleep(3000);
          check(await hubVisible(), `${tag}: return (Space) shows hub`);
        }
      }
      console.log("done", tag);
    } catch (e) { check(false, `${tag}: exception ${e.message}`); }
  }
}
cdp.close(); proc.kill(); await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch {}
console.log(`\n${passes} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
