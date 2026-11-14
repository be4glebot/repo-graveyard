// Task 25.2 probe: badge style picker (header share dialog + repo share dialog), 2 viewports.
// Usage: node docs/design-review/tools/ux-25-2.mjs
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { connectToPage } from "./cdp.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = "http://localhost:3000";
const OUT = resolve("docs/design-review/ux-polish");
mkdirSync(OUT, { recursive: true });
const CHROME = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);
const profile = mkdtempSync(join(tmpdir(), "gv-ux252-"));
const port = 9900 + Math.floor(Math.random() * 90);
const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(250); }
const cdp = await connectToPage(port);
await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
const shot = async (name) => {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, name), Buffer.from(data, "base64"));
};
const goto = async (url, wait) => { const l = cdp.once("Page.loadEventFired", 60000); await cdp.send("Page.navigate", { url }); await l; await sleep(wait); };
const press = async (key, code, vk) => {
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk });
};
const state = `(()=>{const d=document.querySelector('[role=dialog][aria-modal=true]:has([role=radiogroup])');if(!d)return null;
const radios=[...d.querySelectorAll('input[type=radio]')].map(r=>({n:r.getAttribute('aria-label'),c:r.checked}));
const thumbs=[...d.querySelectorAll('[data-testid=style-thumb]')].map(i=>({src:i.getAttribute('src'),ok:i.complete&&i.naturalWidth>0}));
return {radios,thumbs,loading:d.querySelectorAll('[data-testid=style-thumb-loading]').length,failed:d.querySelectorAll('[data-testid=style-thumb-failed]').length,active:document.activeElement&&document.activeElement.getAttribute('aria-label'),md:d.querySelector('textarea').value,scrollW:document.documentElement.scrollWidth,dw:d.getBoundingClientRect().width}})()`;
try {
  for (const [w, h, mobile] of [[1440, 900, false], [390, 844, true]]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
    for (const kind of ["header", "repo"]) {
      const url = kind === "header" ? `${BASE}/g/be4glebot` : `${BASE}/g/be4glebot/jellyfish-plays-pokemon-v2`;
      await goto(url, 7000);
      if (kind === 'repo') { await cdp.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/^jellyfish/.test(b.textContent.trim()));if(b)b.click()})()`); await sleep(2500); }
      if (kind === 'header' && mobile) { await cdp.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Menu');if(b)b.click()})()`); await sleep(800); }
      const label = kind === "header" ? "Share your graveyard" : "Share this repo";
      let clicked = false;
      for (let t = 0; t < 10 && !clicked; t++) {
        clicked = await cdp.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='${label}'&&b.offsetParent!==null)[0];if(!b)return false;b.click();return true})()`);
        if (!clicked) await sleep(1000);
      }
      console.log(w, kind, "clicked", clicked); if(!clicked){console.log(await cdp.evaluate(`JSON.stringify([...document.querySelectorAll('button')].map(b=>b.textContent.trim().slice(0,30)+'|'+(b.offsetParent!==null)).slice(0,40))`)); await shot('25-2-debug.png'); break;}
      // Wait for badge API compile/response (retry).
      let st = null;
      for (let t = 0; t < 20; t++) { await sleep(1500); st = await cdp.evaluate(state); if (st && st.loading === 0) break; }
      console.log(JSON.stringify(st));
      await shot(`25-2-${kind}-${w}x${h}-initial.png`);
      // Keyboard: focus selected radio, ArrowRight selects Plain.
      await cdp.evaluate(`document.querySelector('[role=dialog][aria-modal=true]:has([role=radiogroup]) input[type=radio]:checked').focus()`);
      await press("ArrowRight", "ArrowRight", 39); await sleep(1500);
      st = await cdp.evaluate(state);
      console.log("after ArrowRight", JSON.stringify(st));
      await shot(`25-2-${kind}-${w}x${h}-plain.png`);
      await press("ArrowLeft", "ArrowLeft", 37); await sleep(500);
      console.log("after ArrowLeft", JSON.stringify((await cdp.evaluate(state)).radios));
    }
  }
} finally { cdp.close(); proc.kill(); await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch {} }



