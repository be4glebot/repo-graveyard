import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { contrastRatio, parseHex } from "@/lib/contrast";

// Opaque colours as #rrggbb strings.
const hexColour = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
  )
  .map(
    ([r, g, b]) =>
      "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join(""),
  );

describe("contrast ratio is a well-formed measure", () => {
  // Feature: explorable-worlds, Property 14: Contrast ratio is a well-formed measure
  // **Validates: Requirements 18.5, 17.11**
  it("is in [1, 21], symmetric, and 1 for equal colours", () => {
    fc.assert(
      fc.property(hexColour, hexColour, (a, b) => {
        expect(parseHex(a)).not.toBeNull();
        expect(parseHex(b)).not.toBeNull();
        const ab = contrastRatio(a, b);
        const ba = contrastRatio(b, a);
        expect(Number.isFinite(ab)).toBe(true);
        expect(ab).toBeGreaterThanOrEqual(1);
        expect(ab).toBeLessThanOrEqual(21 + 1e-9);
        expect(ab).toBe(ba);
        expect(contrastRatio(a, a)).toBe(1);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 14 (token part): every declared text/surface token pair in
// app/globals.css meets 4.5. Families are `--color-<family>-text[-muted]` read
// against `--color-<family>-surface[-raised]`.
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readTokens(): Map<string, string> {
  const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
  const out = new Map<string, string>();
  for (const m of css.matchAll(/(--color-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g)) {
    out.set(m[1], m[2]);
  }
  return out;
}

describe("declared text and surface tokens meet contrast", () => {
  // Feature: explorable-worlds, Property 14 (token part)
  // **Validates: Requirements 18.5, 11.3**
  const tokens = readTokens();
  const pairs: [string, string][] = [];
  for (const family of ["stone", "brass", "tag"]) {
    const texts = [...tokens.keys()].filter((k) =>
      new RegExp(`^--color-${family}-text(-muted)?$`).test(k),
    );
    const surfaces = [...tokens.keys()].filter((k) =>
      new RegExp(`^--color-${family}-surface(-raised)?$`).test(k),
    );
    for (const t of texts) for (const s of surfaces) pairs.push([t, s]);
  }

  it("declares at least one pair per family", () => {
    expect(pairs.length).toBeGreaterThanOrEqual(3);
  });

  it("every pair is at least 4.5", () => {
    fc.assert(
      fc.property(fc.constantFrom(...pairs), ([t, s]) => {
        expect(contrastRatio(tokens.get(t)!, tokens.get(s)!)).toBeGreaterThanOrEqual(4.5);
      }),
      { numRuns: Math.max(100, pairs.length * 10) },
    );
  });
});
