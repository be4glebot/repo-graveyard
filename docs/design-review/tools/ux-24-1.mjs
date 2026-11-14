// Task 24.1 probe: bottom-gap shots, scrollbar widths, travel frames.
// Usage: node docs/design-review/tools/ux-24-1.mjs <bottom|travel> --tag before|after [--base url]
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { connectToPage } from "./cdp.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const argv = process.argv.slice(2);
const mode = argv[0];
const args = {};
for (let i = 1; i < argv.length; i += 2) args[argv[i].slice(2)] = argv[i + 1];
const BASE = (args.base || "http://localhost:3000").replace(/\/$/, "");
const TAG = args.tag || "before";
const OUT = resolve("docs/design-review/ux-polish");
mkdirSync(OUT, { recursive: true });
const CHROME = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);

async function launch() {
  const profile = mkdtempSync(join(tmpdir(), "gv-ux-"));
  const port = 9600 + Math.floor(Math.random() * 300);
  const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(250); }
  const cdp = await connectToPage(port);
  await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
  return { cdp, close: async () => { cdp.close(); proc.kill(); await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch {} } };
}
const viewport = async (cdp, w, h, mobile) => {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
};
const shot = async (cdp, name) => {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, name), Buffer.from(data, "base64"));
};
const goto = async (cdp, url) => { const l = cdp.once("Page.loadEventFired", 30000); await cdp.send("Page.navigate", { url }); await l; await sleep(2200); };
const click = (cdp, place) => cdp.evaluate(`(()=>{const b=document.querySelector('[data-testid="estate-place-${place}"]');if(!b)return false;b.click();return true})()`);

const VPS = [[1440, 900, false], [390, 844, true]];
const results = [];
const SB = `(()=>[...document.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+1&&/auto|scroll/.test(getComputedStyle(e).overflowY)).map(e=>({t:e.getAttribute('data-testid')||e.tagName,sbw:e.offsetWidth-e.clientWidth,sh:e.scrollHeight,ch:e.clientHeight})))()`;
const { cdp, close } = await launch();
try {
  for (const [w, h, m] of VPS) {
    await viewport(cdp, w, h, m);
    for (const place of ["sky", "ground", "crypt"]) {
      await goto(cdp, `${BASE}/estate`);
      if (mode === "scrollbars") {
        console.log(w, "hub", JSON.stringify(await cdp.evaluate(SB)));
        for (const p of ["gate", "sky", "ground", "crypt"]) {
          await goto(cdp, `${BASE}/estate`);
          await click(cdp, p);
          await sleep(3800);
          console.log(w, p, JSON.stringify(await cdp.evaluate(SB)));
        }
        break;
      }
      if (mode === "bottom") {
        await click(cdp, place);
        await sleep(3800);
        await cdp.evaluate(`(()=>{const s=document.querySelector('[data-world-scroller]');s.scrollTop=s.scrollHeight})()`);
        await sleep(900);
        const info = await cdp.evaluate(`(()=>{
          const s=document.querySelector('[data-world-scroller]');
          const sr=s.getBoundingClientRect();
          const stage=document.querySelector('[data-testid="world-stage"]').getBoundingClientRect();
          const art=[...document.querySelectorAll('[data-decor-clip], [data-testid*="art"], [data-art]')].map(e=>{const r=e.getBoundingClientRect();return{t:e.getAttribute('data-testid')||e.tagName,top:Math.round(r.top),bot:Math.round(r.bottom)}});
          window.__bands=[...document.querySelectorAll('.world-band,[data-decor-clip]')].map(e=>{const r=e.getBoundingClientRect();return e.className.toString().replace(/pointer-events-none|overflow-clip/g,'').trim().slice(0,28)+' '+Math.round(r.top)+'..'+Math.round(r.bottom)});
          const maxArtBottom=Math.max(...art.filter(a=>a.bot>0).map(a=>a.bot));
          return{vh:innerHeight,scrollerBottom:sr.bottom,sbw:s.offsetWidth-s.clientWidth,stageBottom:Math.round(stage.bottom),scrollH:s.scrollHeight,top:s.scrollTop,client:s.clientHeight,maxArtBottom,docSbw:innerWidth-document.documentElement.clientWidth,bodyOverflow:getComputedStyle(document.body).overflowY}
        })()`);
        info.bands = await cdp.evaluate(`window.__bands`);
        results.push({ place, w, h, ...info });
        console.log(TAG, place, w, JSON.stringify(info));
        await shot(cdp, `24-1-${TAG}-bottom-${place}-${w}x${h}.png`);
      } else {
        // travel frames
        await cdp.evaluate(`(()=>{window.__t0=performance.now()})()`);
        const times = [0, 150, 300, 450, 600, 800, 1000, 1150, 1500, 2200];
        await click(cdp, place);
        await cdp.send("Emulation.setVirtualTimePolicy", { policy: "pause" });
        const t0 = Date.now();
        // Back-to-back captures (screenshots take ~100+ ms each), named by the
        // real elapsed ms so the frame order and timing are honest.
        // Virtual time: advance exactly 100 ms per step so frames are at exact
        // animation times regardless of screenshot latency.
        let e = 0;
        const step = 100;
        while (e <= 2400) {
          const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 60 });
          writeFileSync(join(OUT, `24-1-${TAG}-travel-${place}-${w}-${String(e).padStart(4, "0")}.jpg`), Buffer.from(data, "base64"));
          const done = cdp.once("Emulation.virtualTimeBudgetExpired", 20000);
          await cdp.send("Emulation.setVirtualTimePolicy", { policy: "pauseIfNetworkFetchesPending", budget: step });
          await done;
          e += step;
        }
        await cdp.send("Emulation.setVirtualTimePolicy", { policy: "advance" });
        void times; void t0;
      }
    }
  }
} finally { await close(); }
writeFileSync(join(OUT, `24-1-${TAG}-${mode}.json`), JSON.stringify(results, null, 1));

