import { existsSync, openSync, readSync, closeSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Req 17.1, 20.2: the Baseline_Screenshots of the original app must exist.
const DIR = path.resolve(__dirname, "../../docs/design-review");
const DATE = "2026-11-12";
const VIEWPORTS = ["1440x900", "1920x1080", "390x844", "360x740"];
const MATRIX: Record<string, string[]> = {
  hub: ["ghosts-3"],
  gate: ["ghosts-3"],
  sky: ["ghosts-3", "empty", "ghosts-12"],
  ground: ["empty", "tombstones-3", "tombstones-12"],
  crypt: ["empty", "coffins-3", "coffins-12"],
};
const STRICT_PATTERN =
  /^\d{4}-\d{2}-\d{2}-baseline-(hub|gate|sky|ground|crypt)-(empty|(ghosts|tombstones|coffins)-(3|12))-\d+x\d+\.png$/;

const expected: string[] = [];
for (const [place, cases] of Object.entries(MATRIX)) {
  for (const c of cases) {
    for (const vp of VIEWPORTS) {
      expected.push(`${DATE}-baseline-${place}-${c}-${vp}.png`);
    }
  }
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function readMagic(file: string): number[] {
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(8);
    readSync(fd, buf, 0, 8, 0);
    return [...buf];
  } finally {
    closeSync(fd);
  }
}

describe("baseline screenshot manifest", () => {
  it("expects one file per place, case and viewport", () => {
    expect(expected.length).toBe(new Set(expected).size);
    expect(expected.length).toBe(44);
  });

  it.each(expected)("%s exists, matches the pattern and is a PNG", (name) => {
    const file = path.join(DIR, name);
    expect(existsSync(file)).toBe(true);
    expect(name).toMatch(STRICT_PATTERN);
    expect(readMagic(file)).toEqual(PNG_MAGIC);
  });

  it("has no unexpected baseline files", () => {
    const found = readdirSync(DIR).filter((f) => f.includes("-baseline-") && f.endsWith(".png"));
    expect(found.sort()).toEqual([...expected].sort());
  });
});
