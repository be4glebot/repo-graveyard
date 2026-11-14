// Task 24.2 probe: turning-soon notice frames and seance candle frames.
// Usage: node docs/design-review/tools/ux-24-2.mjs <notice|candles> --tag before|after [--reduced 1]
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
const BASE = "http://localhost:3000";
const TAG = args.tag || "after";
const RM = args.reduced ? "-rm" : "";
const OUT = resolve("docs/design-review/ux-polish");
mkdirSync(OUT, { recursive: true });
const CHROME = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);

const profile = mkdtempSync(join(tmpdir(), "gv-ux2-"));
const port = 9900 + Math.floor(Math.random() * 90);
const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(250); }
const cdp = await connectToPage(port);
await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
if (args.reduced) await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
const shot = async (name, clip) => {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
  writeFileSync(join(OUT, name), Buffer.from(data, "base64"));
};
const goto = async (url, wait = 3500) => { const l = cdp.once("Page.loadEventFired", 40000); await cdp.send("Page.navigate", { url }); await l; await sleep(wait); };
try {
  if (mode === "notice") {
    await goto(`${BASE}/g/${args.user || "be4glebot"}`, 6000);
    const info = await cdp.evaluate(`(()=>{const n=document.querySelector('[data-testid="scene-turning-soon"]');if(!n)return null;const r=n.getBoundingClientRect();const cs=getComputedStyle(n,'::after');return{x:r.x,y:r.y,w:r.width,h:r.height,text:n.textContent,period:getComputedStyle(n).getPropertyValue('--pulse-period'),anim:cs.animationName,dur:cs.animationDuration}})()`);
    console.log(JSON.stringify(info));
    if (info) {
      const clip = { x: Math.max(0, info.x - 40), y: Math.max(0, info.y - 30), width: info.w + 80, height: info.h + 60 };
      const t0 = Date.now();
      for (const t of [0, 150, 300, 450, 600, 750, 900, 1050, 1200, 1500]) {
        const w = t - (Date.now() - t0); if (w > 0) await sleep(w);
        await shot(`24-2-${TAG}-notice${RM}-${String(t).padStart(4, "0")}.png`, clip);
      }
    }
    await shot(`24-2-${TAG}-notice${RM}-full.png`);
  } else {
    await goto(`${BASE}/g/be4glebot/${args.repo || "jellyfish-plays-pokemon-v2"}`, 6000);
    await cdp.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role=button]')].find(b=>/jellyfish/i.test(b.getAttribute('aria-label')||''));if(b)b.click()})()`); await sleep(2500);
    await shot(`24-2-${TAG}-panel${RM}.png`);
    const ok = await cdp.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/Hold a s/.test(b.textContent));if(!b)return false;b.click();return true})()`);
    console.log("clicked", ok);
    const t0 = Date.now();
    for (const t of [600, 1000, 1500, 2200, 3000, 4500]) {
      const w = t - (Date.now() - t0); if (w > 0) await sleep(w);
      await shot(`24-2-${TAG}-candles${RM}-${String(t).padStart(4, "0")}.png`);
    }
  }
} finally { cdp.close(); proc.kill(); await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch {} }

