import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Source scan: every `/art/*.webp` literal under components/ and app/ must sit
 * inside a `themeArt(` call, so night art can never bypass the theme swap.
 *
 * Requirements: 3.2, 3.6
 */

const ROOT = path.resolve(__dirname, "../..");
const SCAN_DIRS = ["components", "app"];

/**
 * Allowlist: posix-style path relative to the repo root -> justification.
 * lib/theme-art.ts and data files live outside the scanned dirs; only
 * unavoidable literals inside components/ and app/ belong here.
 */
const ALLOWLIST: Record<string, string> = {
  // DayBirds renders day-only art (/art/day/bird-perch.webp) that has no night
  // counterpart, so there is no night path to hand to themeArt. The component
  // is only mounted in the day theme.
  "components/world/DayBirds.tsx":
    "day-only perched robin sprite with no night counterpart; themeArt maps night->day",
};

const ART_LITERAL = /\/art\/[^"'`\s)]*?\.webp/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Blank out comments (same length, so indexes stay valid). */
function stripComments(src: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, " ");
  return src
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:\w"'`])\/\/[^\n]*/g, (m, p1: string) => p1 + blank(m.slice(p1.length)));
}

/** [start, end) ranges of every `themeArt(...)` argument list. */
function themeArtRanges(src: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const re = /themeArt\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
    }
    ranges.push([start, i]);
  }
  return ranges;
}

function findViolations(file: string): string[] {
  const src = stripComments(fs.readFileSync(file, "utf8"));
  const ranges = themeArtRanges(src);
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const bad: string[] = [];
  for (const m of src.matchAll(ART_LITERAL)) {
    const idx = m.index ?? 0;
    if (ranges.some(([s, e]) => idx >= s && idx < e)) continue;
    const line = src.slice(0, idx).split("\n").length;
    bad.push(`${rel}:${line} ${m[0]}`);
  }
  return bad;
}

describe("night art literals", () => {
  it("every /art/*.webp literal in components/ and app/ is inside themeArt(", () => {
    const violations: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(path.join(ROOT, dir))) {
        const rel = path.relative(ROOT, file).split(path.sep).join("/");
        if (rel in ALLOWLIST) continue;
        violations.push(...findViolations(file));
      }
    }
    expect(violations).toEqual([]);
  });

  it("allowlisted files exist and carry a justification", () => {
    for (const [rel, why] of Object.entries(ALLOWLIST)) {
      expect(fs.existsSync(path.join(ROOT, rel)), rel).toBe(true);
      expect(why.length).toBeGreaterThan(10);
    }
  });

  it("the scanner flags a bare literal", () => {
    const tmp = path.join(ROOT, "tests", "unit", "__scan-fixture.tsx");
    fs.writeFileSync(tmp, 'const a = "/art/ghost-0.webp"; const b = themeArt(t, "/art/x.webp");');
    try {
      const v = findViolations(tmp);
      expect(v).toHaveLength(1);
      expect(v[0]).toContain("/art/ghost-0.webp");
    } finally {
      fs.unlinkSync(tmp);
    }
  });
});
