// Hydration check (task 23.1). Headless Chrome over CDP, built-ins plus ./cdp.mjs.
//   node docs/design-review/tools/hydration-check.mjs [--base http://localhost:3000]
//        [--paths "/g/defunkt?at=ground,/g/defunkt?at=sky,/g/defunkt?at=crypt,/g/defunkt?at=gate,/estate?at=ground"]
//        [--sizes 1440x900,1280x720,390x844,3840x2160] [--verbose]
// Hard-reloads every path at every size and records console errors, log entries,
// exceptions and the Next dev overlay text. Exits 1 when any hydration warning
// ("hydrat" / "didn't match" / "did not match") is seen, or a page fails to load.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectToPage } from "./cdp.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 ? argv[i + 1] : d; };
const BASE = arg("base", "http://localhost:3000").replace(/\/$/, "");
const PATHS = arg(
  "paths",
  "/g/defunkt?at=ground,/g/defunkt?at=sky,/g/defunkt?at=crypt,/g/defunkt?at=gate,/g/defunkt,/estate?at=ground,/estate?at=sky,/estate?at=crypt,/estate",
).split(",");
const SIZES = arg("sizes", "1440x900,1280x720,390x844,3840x2160").split(",");
const VERBOSE = argv.includes("--verbose");
const PATTERN = /hydrat|didn['\u2019]?t match|did not match|server rendered HTML/i;

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find(existsSync);
if (!CHROME) { console.error("No Chrome/Edge found"); process.exit(2); }

const profile = mkdtempSync(join(tmpdir(), "gv-hydr-"));
const port = 9400 + Math.floor(Math.random() * 300);
const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
const cleanup = () => { try { proc.kill(); } catch {} try { rmSync(profile, { recursive: true, force: true }); } catch {} };

for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(250); }
const cdp = await connectToPage(port);
await cdp.send("Page.enable"); await cdp.send("Runtime.enable"); await cdp.send("Log.enable");
await cdp.send("Network.enable"); await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

let seen = [];
const fmtArg = (a) => a.value !== undefined ? String(a.value) : (a.description ?? a.type);
cdp.on("Runtime.consoleAPICalled", (p) => {
  if (p.type === "error" || p.type === "warning") seen.push(`console.${p.type}: ${p.args.map(fmtArg).join(" ")}`);
});
cdp.on("Log.entryAdded", (p) => { if (p.entry.level === "error" || p.entry.level === "warning") seen.push(`log.${p.entry.level}: ${p.entry.text}`); });
cdp.on("Runtime.exceptionThrown", (p) => seen.push(`exception: ${p.exceptionDetails.exception?.description ?? p.exceptionDetails.text}`));

const overlayJs = `(() => {
  const out = [];
  for (const host of document.querySelectorAll('nextjs-portal')) {
    const root = host.shadowRoot;
    if (root) out.push(root.textContent || '');
  }
  return out.join(' ').slice(0, 4000);
})()`;

let failures = 0;
let runs = 0;
try {
  for (const size of SIZES) {
    const [w, h] = size.split("x").map(Number);
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
    for (const path of PATHS) {
      seen = [];
      await cdp.send("Page.navigate", { url: "about:blank" });
      await sleep(150);
      const loaded = cdp.once("Page.loadEventFired", 60000);
      await cdp.send("Page.navigate", { url: BASE + path });
      try { await loaded; } catch { seen.push("load timeout"); }
      await sleep(3500);
      let overlay = "";
      try { overlay = await cdp.evaluate(overlayJs); } catch {}
      const hits = [...seen, overlay ? `overlay: ${overlay}` : ""].filter((s) => s && PATTERN.test(s));
      const loadFail = seen.includes("load timeout");
      runs++;
      if (hits.length || loadFail) {
        failures++;
        console.log(`FAIL ${size} ${path}`);
        for (const s of (loadFail ? ["load timeout"] : hits)) console.log("   ", VERBOSE ? s : s.slice(0, 600));
      } else {
        console.log(`ok   ${size} ${path}${seen.length ? ` (${seen.length} unrelated console messages)` : ""}`);
      }
    }
  }
} finally {
  cdp.close();
  cleanup();
}
console.log(`${runs - failures}/${runs} clean`);
process.exit(failures ? 1 : 0);
