// Lights On (day) check: opens /estate and /g/<user> at 1440x800, turns Lights On,
// saves a screenshot and scans the DOM for night /art/ URLs outside /art/day/.
// Run `npm run dev` first. Usage: node docs/design-review/tools/day-check.mjs [--date YYYY-MM-DD]
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { connectToPage } from "./cdp.mjs";
import { browserCandidates } from "./capture.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const argDate = process.argv.indexOf("--date");
const date = argDate > 0 ? process.argv[argDate + 1] : new Date().toISOString().slice(0, 10);
const base = "http://localhost:3000";
const outDir = resolve("docs/design-review");
mkdirSync(outDir, { recursive: true });

const browser = browserCandidates().find((p) => existsSync(p));
if (!browser) throw new Error("No Chrome/Edge found");
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(browser, [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "day-check-"))}`,
  "--no-first-run",
  "about:blank",
], { stdio: "ignore" });

const SCAN = `(() => {
  const urls = new Set();
  const add = (u) => u && urls.add(u);
  for (const img of document.querySelectorAll("img")) { add(img.currentSrc || img.src); add(img.getAttribute("src")); }
  for (const el of document.querySelectorAll("*")) {
    const bg = getComputedStyle(el).backgroundImage;
    for (const m of bg.matchAll(/url\\(["']?([^"')]+)["']?\\)/g)) add(m[1]);
  }
  const decode = (u) => { try { const x = new URL(u, location.href); const q = x.searchParams.get("url"); return q ? decodeURIComponent(q) : x.pathname; } catch { return u; } };
  const all = [...urls].map(decode).filter((u) => u.includes("/art/"));
  const night = all.filter((u) => !u.includes("/art/day/"));
  const ids = ["empty-ground-plate-image","empty-ground-gate-image","empty-ground-fence-left-image","empty-ground-fence-right-image","empty-ground-mausoleum-image"];
  const empty = {};
  for (const id of ids) {
    const el = document.querySelector('[data-testid="' + id + '"]');
    empty[id] = el ? decode(el.currentSrc || el.src || getComputedStyle(el).backgroundImage) : null;
  }
  return { theme: document.querySelector("#scene-root")?.getAttribute("data-theme") ?? null, allArt: all, night, empty };
})()`;

try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {}
    await sleep(250);
  }
  const cdp = await connectToPage(port);
  await cdp.send("Page.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 800, deviceScaleFactor: 1, mobile: false });
  const results = {};
  for (const [name, path] of [["estate", "/estate"], ["be4glebot", "/g/be4glebot"]]) {
    await cdp.send("Page.navigate", { url: base + path });
    await sleep(9000); // load + opening sequence
    await cdp.evaluate(`(() => { const b = [...document.querySelectorAll("button")].find((b) => /skip/i.test(b.textContent)); b?.click(); })()`);
    await sleep(1500);
    const toggled = await cdp.evaluate(`(() => {
      const b = [...document.querySelectorAll("button,[role=switch]")].find((b) => /lights on/i.test(b.textContent + (b.getAttribute("aria-label") ?? "")));
      if (!b) return false;
      if (b.getAttribute("aria-pressed") !== "true") b.click();
      return true;
    })()`);
    await sleep(2500);
    const scan = await cdp.evaluate(SCAN);
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
    const file = join(outDir, `${date}-day-check-${name}-1440x800.png`);
    writeFileSync(file, Buffer.from(data, "base64"));
    results[name] = { toggled, file, ...scan, title: await cdp.evaluate("document.title"), bodyStart: await cdp.evaluate("document.body.innerText.slice(0,160)") };
  }
  console.log(JSON.stringify(results, null, 2));
  cdp.close();
} finally {
  proc.kill();
}
