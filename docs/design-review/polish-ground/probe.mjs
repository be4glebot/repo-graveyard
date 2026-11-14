// Geometry probe for the ground scene at a CSS viewport. Usage: node probe.mjs WxH
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectToPage } from "../tools/cdp.mjs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [w, h] = process.argv[2].split("x").map(Number);
const CH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9700 + Math.floor(Math.random() * 200);
const proc = spawn(CH, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "pr-"))}`, "--disable-gpu", "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(250); }
const cdp = await connectToPage(port);
await cdp.send("Page.enable");
await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
const l = cdp.once("Page.loadEventFired", 40000);
await cdp.send("Page.navigate", { url: "http://localhost:3000/g/defunkt" });
await l; await sleep(2500);
await cdp.evaluate(`(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));[...document.querySelectorAll('button')].find(b=>/skip/i.test(b.textContent||''))?.click()})()`);
await sleep(1200);
await cdp.evaluate(`document.querySelector('[data-testid="estate-place-ground"]')?.click()`);
await sleep(4000);
console.log(JSON.stringify(await cdp.evaluate(`(()=>{const r=e=>{const b=e.getBoundingClientRect();return [Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)]};
return {vw:innerWidth,mist:[...document.querySelectorAll('[data-testid="place-mist-far"],[data-testid="place-mist-near"]')].map(e=>({id:e.dataset.testid,box:r(e),img:r(e.firstElementChild),bg:e.firstElementChild.style.backgroundSize+' @ '+e.firstElementChild.style.backgroundPosition})),
stones:[...document.querySelectorAll('[data-testid="world-creature"]')].slice(0,12).map(r)}})()`)));
cdp.close(); proc.kill(); process.exit(0);
