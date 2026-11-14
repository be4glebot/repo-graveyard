/**
 * Source scan: art paths go through `themeArt`, and touched components use
 * tokens instead of hex colors.
 * Requirements: 3.2, 3.6, 2.5
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

/** Drops comments so doc text mentioning art paths or hex does not count. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Matches every `/art/...webp` literal and returns the ones not inside a themeArt( call. */
function unwrappedArtLiterals(src: string): string[] {
  const code = stripComments(src);
  const bad: string[] = [];
  const re = /\/art\/[^"'`\s)]*\.webp/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    // Look back to the nearest "themeArt(" on the same statement (no `;` between).
    const before = code.slice(Math.max(0, m.index - 200), m.index);
    const stmt = before.slice(before.lastIndexOf(";") + 1);
    if (!/themeArt\(/.test(stmt)) bad.push(m[0]);
  }
  return bad;
}

const WIRED = ["components/world/GroundArt.tsx", "components/world/CropLayer.tsx"];

const TOUCHED = [
  "components/world/GroundArt.tsx",
  "components/world/CropLayer.tsx",
  "components/creatures/Creature.tsx",
  "components/scene/LanternCursor.tsx",
  "components/scene/Fog.tsx",
  "components/scene/ShellFog.tsx",
  "components/scene/ThemeProvider.tsx",
];

describe("theme art wiring (source scan)", () => {
  it.each(WIRED)("%s has no /art/*.webp literal outside themeArt(", (file) => {
    expect(unwrappedArtLiterals(read(file))).toEqual([]);
  });

  it.each(TOUCHED)("%s contains no hex colors", (file) => {
    const hex = stripComments(read(file)).match(/#[0-9a-fA-F]{3,8}\b/g);
    expect(hex).toBeNull();
  });
});
