/**
 * Crypt join and grounding regression tests (task 20.3, defect 4):
 * the seam probe on synthetic frames, the cross-fade mask, the confined
 * staircase, and the coffin grounding model.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  CRYPT_STAIR_SPAN_PCT,
  CRYPT_ZONE_OPACITY,
  STAIR_MASK,
  cryptBackgroundMask,
} from "@/components/world/CryptArt";
import {
  COFFIN_SHADOW_MAX_OPACITY,
  COFFIN_SHADOW_MIN_OPACITY,
  coffinGroundingFor,
} from "@/lib/world-light";
import {
  SEAM_LIMIT,
  seamDifference,
} from "../../docs/design-review/tools/page-probes.mjs";

/** Build an RGBA frame whose row luminance is `rowL(y)`. */
function frame(width: number, height: number, rowL: (y: number) => number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = rowL(y);
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  return d;
}

describe("seam probe at a crypt join", () => {
  it("flags a hard step and passes a linear cross-fade", () => {
    const hard = frame(8, 40, (y) => (y < 20 ? 30 : 90));
    expect(seamDifference(hard, 8, 40, 20).pass).toBe(false);
    // A linear cross-fade from 30 to 90 over 40 rows: 1.5 per row.
    const soft = frame(8, 40, (y) => 30 + 1.5 * y);
    const s = seamDifference(soft, 8, 40, 20);
    expect(s.pass).toBe(true);
    expect(s.share).toBeLessThan(SEAM_LIMIT);
  });

  it("a night-coloured dip in the middle of the join (the old double fade) is a visible step", () => {
    // Both bands fading out/in at once leaves 25% night at the centre.
    const dip = frame(8, 40, (y) => {
      const t = y / 39;
      return (1 - (1 - t) * t) * (30 + 60 * t) + (1 - t) * t * 5;
    });
    const plain = frame(8, 40, (y) => 30 + 60 * (y / 39));
    const a = seamDifference(dip, 8, 40, 20).share;
    const b = seamDifference(plain, 8, 40, 20).share;
    expect(a).toBeLessThan(1);
    expect(b).toBeLessThanOrEqual(SEAM_LIMIT);
  });
});

describe("crypt join blend", () => {
  it("a background band only fades in at its top; the band above stays opaque", () => {
    const mask = cryptBackgroundMask(120);
    expect(mask).toContain("transparent 0");
    expect(mask).toContain("black 120px");
    expect(mask).not.toContain("transparent 100%");
    expect(mask).not.toContain("calc(100% -");
    expect(cryptBackgroundMask(0)).toBeUndefined();
  });

  it("confines the staircase to the middle of the entry and keeps the zone overlay faint", () => {
    expect(CRYPT_STAIR_SPAN_PCT).toBeLessThanOrEqual(50);
    // The horizontal layer is transparent at both ends (never a full-width line).
    expect(STAIR_MASK.startsWith("linear-gradient(to right, transparent")).toBe(true);
    expect(STAIR_MASK).toMatch(/transparent 78%\)/);
    expect(CRYPT_ZONE_OPACITY).toBeLessThanOrEqual(0.2);
  });
});

describe("coffin grounding", () => {
  it("keeps the shadow tight, dark and within bounds for any band and size", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.double({ min: -2, max: 3, noNaN: true }), fc.constant(null), fc.constant(undefined)),
        fc.oneof(fc.integer({ min: 20, max: 400 }), fc.constant(0), fc.constant(Number.NaN)),
        (band, size) => {
          const g = coffinGroundingFor(band, size);
          expect(g.shadow.opacity).toBeGreaterThanOrEqual(COFFIN_SHADOW_MIN_OPACITY - 1e-9);
          expect(g.shadow.opacity).toBeLessThanOrEqual(COFFIN_SHADOW_MAX_OPACITY + 1e-9);
          expect(Number.isFinite(g.shadow.offsetY)).toBe(true);
          expect(Number.isFinite(g.shadow.blur)).toBe(true);
          // Tighter than a standing creature's key-light offset (0.35 * 0.35 * size).
          const px = size > 0 ? size : 64;
          expect(g.shadow.offsetY).toBeLessThan(0.1225 * px);
          expect(g.floorLine.widthFactor).toBeGreaterThan(1);
          expect(g.floorLine.opacity).toBeGreaterThan(0);
          expect(g.floorLine.opacity).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});
