import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BADGE_PALETTE, buildBadge } from "@/lib/badge";

/** Concatenate the bodies of every `@theme` / `@theme inline` block. */
function themeBlocks(css: string): string {
  let out = "";
  const re = /@theme\b[^{]*\{/g;
  while (re.exec(css)) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    out += css.slice(re.lastIndex, i - 1) + "\n";
    re.lastIndex = i;
  }
  return out.toLowerCase();
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const chan = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const STATES = ["ghost", "risen", "zombie", "tombstone", "coffin"] as const;

describe("BADGE_PALETTE", () => {
  const theme = themeBlocks(
    readFileSync(join(process.cwd(), "app", "globals.css"), "utf8"),
  );

  it("only uses hex values defined in the @theme block of globals.css", () => {
    for (const [key, c] of Object.entries(BADGE_PALETTE)) {
      expect(theme, `${key} fill ${c.fill}`).toContain(c.fill.toLowerCase());
      expect(theme, `${key} text ${c.text}`).toContain(c.text.toLowerCase());
    }
  });

  it("gives the five state fills pairwise distinct colours", () => {
    const fills = STATES.map((s) => BADGE_PALETTE[s].fill);
    expect(new Set(fills).size).toBe(5);
  });

  it("gives the neutral fill a colour different from all five states", () => {
    for (const s of STATES) {
      expect(BADGE_PALETTE.neutral.fill).not.toBe(BADGE_PALETTE[s].fill);
    }
  });

  it("keeps text/fill contrast at 4.5 or better for every pair", () => {
    // flatOutline is a stroke colour, never a text background.
    for (const [key, c] of Object.entries(BADGE_PALETTE)) {
      if (key === "flatOutline") continue;
      expect(contrast(c.fill, c.text), key).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("paints the fallback value segment with the grey fallback fill", () => {
    const svg = buildBadge({
      label: "repo graveyard",
      message: "not found",
      tone: "fallback",
      style: "haunted",
    });
    const shapeFills = [...svg.matchAll(/<path [^>]*fill="(#[0-9a-f]{6})"/g)].map(
      (m) => m[1],
    );
    // Value segment is the last shape.
    expect(shapeFills[shapeFills.length - 1]).toBe(BADGE_PALETTE.fallback.fill);
    for (const s of STATES) {
      expect(shapeFills).not.toContain(BADGE_PALETTE[s].fill);
    }
  });
});
