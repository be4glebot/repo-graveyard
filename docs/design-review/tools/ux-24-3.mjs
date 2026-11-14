// Task 24.3 probe: share dialogs + (?) help keyboard behaviour + header fit.
// Usage: node docs/design-review/tools/ux-24-3.mjs [user]
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { connectToPage } from "./cdp.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const user = process.argv[2] || "be4glebot";
const BASE = "http://localhost:3000";
const OUT = resolve("docs/design-review/ux-polish");
mkdirSync(OUT, { recursive: true });
const CHROME = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);
const profile = mkdtempSync(join(tmpdir(), "gv-ux3-"));
const port = 9800 + Math.floor(Math.random() * 90);
const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(250); }
const cdp = await connectToPage(port);
await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
const shot = async (name) => {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, name), Buffer.from(data, "base64"));
};
const goto = async (url, wait = 5000) => { const l = cdp.once("Page.loadEventFired", 40000); await cdp.send("Page.navigate", { url }); await l; await sleep(wait); };
const key = async (k, code) => { await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: code || k, text: { Enter: "\r", " ": " " }[k], windowsVirtualKeyCode: { Enter: 13, Escape: 27, Tab: 9, " ": 32 }[k] }); await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: code || k }); };
const ev = (s) => cdp.evaluate(s);
try {
  for (const [w, h, tag] of [[1440, 900, "1440"], [390, 844, "390"]]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
    await goto(`${BASE}/g/${user}`);
    // lights off scene may be behind the opening; skip with a key/click
    await ev(`document.body.click()`); await sleep(1500);
    await shot(`24-3-${user}-${tag}-header.png`);
    // header metrics
    console.log(tag, "header", JSON.stringify(await ev(`(()=>{const h=document.querySelector('[data-testid=scene-header]');const r=h.getBoundingClientRect();return {w:r.width,h:r.height,sw:document.documentElement.scrollWidth}})()`)));
    if (w < 500) { await ev(`[...document.querySelectorAll('header button')].find(b=>b.textContent==='Menu')?.click()`); await sleep(500); await shot(`24-3-${user}-${tag}-menu.png`); }
    await ev(`(document.querySelector('[data-testid=get-badge-button]')||document.querySelector('[data-testid=get-badge-menu-item]')).click()`);
    await sleep(800);
    await shot(`24-3-${user}-${tag}-share-owner.png`);
    // keyboard: focus help tip via Tab from Close
    await ev(`document.querySelector('[data-testid=share-help]').focus()`);
    await key("Enter");
    await sleep(300);
    console.log(tag, "expanded after Enter", await ev(`document.querySelector('[data-testid=share-help]').getAttribute('aria-expanded')`));
    await shot(`24-3-${user}-${tag}-share-owner-help.png`);
    await key("Escape");
    await sleep(300);
    console.log(tag, "after Esc: expanded", await ev(`document.querySelector('[data-testid=share-help]').getAttribute('aria-expanded')`), "dialog still open", await ev(`!!document.querySelector('[role=dialog]')`), "focus on tip", await ev(`document.activeElement?.getAttribute('data-testid')`));
    await key(" ", "Space");
    await sleep(200);
    console.log(tag, "expanded after Space", await ev(`document.querySelector('[data-testid=share-help]').getAttribute('aria-expanded')`));
    await key("Escape"); await sleep(200); await key("Escape"); await sleep(500);
    console.log(tag, "dialog open after 2nd/3rd Esc", await ev(`!!document.querySelector('[role=dialog]')`));
  }
  // repo dialog
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await goto(`${BASE}/g/${user}/${process.argv[3] || "jellyfish-plays-pokemon-v2"}`, 6000);
  await ev(`(()=>{const b=[...document.querySelectorAll('button,[role=button]')].find(b=>/jellyfish/i.test(b.getAttribute('aria-label')||b.textContent||''));if(b)b.click()})()`); await sleep(3000);
  const opened = await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Share this repo');if(!b)return false;b.click();return true})()`);
  console.log("repo share opened", opened);
  await sleep(800);
  await shot(`24-3-${user}-1440-share-repo.png`);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(600);
  await shot(`24-3-${user}-390-share-repo.png`);
} finally { cdp.close(); proc.kill(); await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
