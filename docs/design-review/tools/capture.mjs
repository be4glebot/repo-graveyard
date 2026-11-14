// Design-review screenshot capture. Drives a local Chrome or Edge over the DevTools
// Protocol (cdp.mjs). Built-ins only. It never starts a dev server: run `npm run dev`
// yourself first. Usage:
//   node docs/design-review/tools/capture.mjs --step baseline
//   node docs/design-review/tools/capture.mjs --step s2 --places sky --cases ghosts-3,empty --reduced --travel
// Options (all optional):
//   --base-url http://localhost:3000   --date YYYY-MM-DD   --step <name|baseline>
//   --places hub,gate,sky,ground,crypt --cases a,b         --viewports 1440x900,390x844
//   --depths 0,0.5,1   --seam (run seam probe per shot, write <date>-<step>-seam-probe.json)   --reduced (also emulate reduced motion)   --travel (travel frames)
//   --out docs/design-review

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { connectToPage } from "./cdp.mjs";
import { blendJoinsExpression, fallbackEdges, luminance, meanRowLuminance, differenceShare, seamDifference, SEAM_ROWS, SEAM_LIMIT, NIGHT_SKY_RGB } from "./page-probes.mjs";

export const VIEWPORTS = [
  { width: 1440, height: 900, mobile: false },
  { width: 1920, height: 1080, mobile: false },
  { width: 390, height: 844, mobile: true },
  { width: 360, height: 740, mobile: true },
];
export const DEPTHS = [0, 0.5, 1];
export const TRAVEL_MS = [0, 1150, 2200];
export const PLACES = ["hub", "gate", "sky", "ground", "crypt"];
export const CASES = {
  sky: ["ghosts-3", "empty", "ghosts-12"],
  ground: ["empty", "tombstones-3", "tombstones-12"],
  crypt: ["empty", "coffins-3", "coffins-12"],
  gate: ["ghosts-3"],
  hub: ["ghosts-3"],
};

/** Browser locations checked, in order, when CHROME_PATH is not set. */
export function browserCandidates(env = process.env) {
  const pf = env.ProgramFiles ?? "C:\\Program Files";
  const pf86 = env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const local = env.LOCALAPPDATA ?? "";
  const list = [];
  if (env.CHROME_PATH) list.push(env.CHROME_PATH);
  list.push(
    join(pf, "Google", "Chrome", "Application", "chrome.exe"),
    join(pf86, "Google", "Chrome", "Application", "chrome.exe"),
    ...(local ? [join(local, "Google", "Chrome", "Application", "chrome.exe")] : []),
    join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"),
    join(pf, "Microsoft", "Edge", "Application", "msedge.exe"),
  );
  return list;
}

/**
 * Pure filename builder.
 * Baseline: YYYY-MM-DD-baseline-<place>-<case>-<w>x<h>.png
 * Other:    YYYY-MM-DD-<step>-<place>-<case>-<w>x<h>-d<depth>.png
 * @param {{date:string, step:string, place:string, caseName:string, width:number, height:number, depth?:number}} p
 */
export function buildFilename({ date, step, place, caseName, width, height, depth = 0 }) {
  const base = `${date}-${step}-${place}-${caseName}-${width}x${height}`;
  return step === "baseline" ? `${base}.png` : `${base}-d${depth}.png`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const k = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) o[k] = true;
    else {
      o[k] = next;
      i++;
    }
  }
  return o;
}

function findBrowser() {
  const checked = browserCandidates();
  return { found: checked.find((p) => existsSync(p)) ?? null, checked };
}

async function waitForPort(port, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("Browser did not open its debugging port");
}

function pageUrl(base, place, caseName, reduced) {
  if (place === "hub") return `${base}/estate`;
  const q = new URLSearchParams({ place, case: caseName });
  if (reduced) q.set("reduced", "1");
  return `${base}/dev/review?${q}`;
}

/** Scroll the world scroller (or the window) to a depth between 0 and 1. */
const scrollExpression = (depth) => `(() => {
  const cands = Array.from(document.querySelectorAll('[data-world-scroller], [role="region"], main, div'));
  const el = cands.find((e) => {
    const s = getComputedStyle(e);
    return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 1;
  });
  if (el) { el.scrollTop = (el.scrollHeight - el.clientHeight) * ${depth}; return "element"; }
  const max = document.documentElement.scrollHeight - innerHeight;
  window.scrollTo(0, Math.max(0, max) * ${depth});
  return "window";
})()`;

async function setViewport(cdp, vp) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: 1,
    mobile: vp.mobile,
  });
}

async function shot(cdp, file) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(file, Buffer.from(data, "base64"));
  console.log("wrote", file);
  return data;
}

/** In-page seam probe: decodes the PNG and runs the pure helpers from page-probes.mjs. */
function seamExpression(b64, joins) {
  return `(async () => {
    ${luminance}
    ${meanRowLuminance}
    ${differenceShare}
    ${seamDifference}
    ${fallbackEdges}
    const SEAM_ROWS = ${SEAM_ROWS}, SEAM_LIMIT = ${SEAM_LIMIT}, NIGHT_SKY_RGB = ${JSON.stringify(NIGHT_SKY_RGB)};
    const img = new Image();
    img.src = "data:image/png;base64," + ${JSON.stringify(b64)};
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    return {
      seams: ${JSON.stringify(joins)}.map((j) => ({ zone: j.zone, y: j.y, ...seamDifference(d, c.width, c.height, j.y) })),
      fallbackEdges: fallbackEdges(d, c.width, c.height),
    };
  })()`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const step = typeof args.step === "string" ? args.step : "baseline";
  const date = typeof args.date === "string" ? args.date : new Date().toISOString().slice(0, 10);
  const base = (typeof args["base-url"] === "string" ? args["base-url"] : "http://localhost:3000").replace(/\/$/, "");
  const outDir = resolve(typeof args.out === "string" ? args.out : "docs/design-review");
  const places = typeof args.places === "string" ? args.places.split(",") : PLACES;
  const vps =
    typeof args.viewports === "string"
      ? args.viewports.split(",").map((s) => {
          const [w, h] = s.split("x").map(Number);
          return VIEWPORTS.find((v) => v.width === w && v.height === h) ?? { width: w, height: h, mobile: w < 600 };
        })
      : VIEWPORTS;
  const depths = typeof args.depths === "string" ? args.depths.split(",").map(Number) : DEPTHS;
  const baseline = step === "baseline";

  const { found, checked } = findBrowser();
  if (!found) {
    console.error("No Chrome or Edge found. Checked paths (set CHROME_PATH to override):");
    for (const p of checked) console.error("  " + p);
    process.exit(1);
  }
  try {
    const res = await fetch(base);
    if (!res.ok && res.status >= 500) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.error(`Dev server not reachable at ${base} (${e.message}). Start it with: npm run dev`);
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  const profile = mkdtempSync(join(tmpdir(), "graveyard-capture-"));
  const port = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(
    found,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let cdp;
  let failed = false;
  const seamLog = [];
  try {
    await waitForPort(port);
    cdp = await connectToPage(port);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    const motionModes = args.reduced ? [false, true] : [false];
    for (const place of places) {
      const cases = typeof args.cases === "string" ? args.cases.split(",") : CASES[place] ?? ["ghosts-3"];
      for (const caseName of cases) {
        for (const reduced of motionModes) {
          if (baseline && reduced) continue;
          for (const vp of vps) {
            await setViewport(cdp, vp);
            await cdp.send("Emulation.setEmulatedMedia", {
              features: [{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }],
            });
            const label = reduced ? `${caseName}-reduced` : caseName;
            const load = cdp.once("Page.loadEventFired", 30000);
            await cdp.send("Page.navigate", { url: pageUrl(base, place, caseName, reduced) });
            await load;
            await sleep(1200);
            for (const d of baseline ? [0] : depths) {
              await cdp.evaluate(scrollExpression(d));
              await sleep(350);
              await shot(cdp, join(outDir, buildFilename({ date, step, place, caseName: label, width: vp.width, height: vp.height, depth: d })));
              if (args.seam) {
                const joins = await cdp.evaluate(blendJoinsExpression);
                // Probe a chrome-free frame: title, chips, pager and creatures would otherwise
                // sit in the 4-row bands and read as a seam.
                await cdp.evaluate(`(() => { let s = document.getElementById("__seam_hide"); if (!s) { s = document.createElement("style"); s.id = "__seam_hide"; s.textContent = "[data-testid=world-chrome-top],[data-testid=world-chrome-bottom],[data-testid=depth-marker],[data-testid=scatter-creature],nextjs-portal,[data-world-pager],nav,button{visibility:hidden !important}"; document.head.appendChild(s); } })()`);
                await sleep(100);
                const clean = (await cdp.send("Page.captureScreenshot", { format: "png" })).data;
                await cdp.evaluate(`document.getElementById("__seam_hide")?.remove()`);
                const probe = await cdp.evaluate(seamExpression(clean, joins));
                seamLog.push({ place, case: label, viewport: `${vp.width}x${vp.height}`, depth: d, ...probe });
              }
            }
          }
        }
      }
    }

    if (args.travel && !baseline) {
      for (const place of places.filter((p) => p !== "hub")) {
        for (const reduced of motionModes) {
          for (const vp of vps) {
            await setViewport(cdp, vp);
            await cdp.send("Emulation.setEmulatedMedia", {
              features: [{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }],
            });
            const load = cdp.once("Page.loadEventFired", 30000);
            await cdp.send("Page.navigate", { url: `${base}/estate` });
            await load;
            await sleep(1200);
            const clicked = await cdp.evaluate(
              `(() => { const b = document.querySelector('[data-testid="estate-place-${place}"]'); if (!b) return false; b.click(); return true; })()`,
            );
            if (!clicked) {
              console.error(`travel: no button for ${place}`);
              continue;
            }
            const t0 = Date.now();
            for (const t of TRAVEL_MS) {
              await sleep(Math.max(0, t - (Date.now() - t0)));
              const caseName = `travel-t${t}${reduced ? "-reduced" : ""}`;
              await shot(cdp, join(outDir, buildFilename({ date, step, place, caseName, width: vp.width, height: vp.height, depth: 0 })));
            }
          }
        }
      }
    }
  } catch (e) {
    failed = true;
    console.error("capture failed:", e.message);
  } finally {
    if (args.seam) {
      const f = join(outDir, `${date}-${step}-seam-probe.json`);
      writeFileSync(f, JSON.stringify(seamLog, null, 1));
      console.log("wrote", f);
    }
    cdp?.close();
    proc.kill();
    await sleep(500);
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* profile may still be locked; the OS temp dir cleans it */
    }
  }
  process.exit(failed ? 1 : 0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) main();
