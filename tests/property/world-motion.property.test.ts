import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  depthPosition,
  bandOffset,
  BAND_RATES,
  PARALLAX_MAX,
  classifyGesture,
  GESTURE_TAP_MAX_PX,
  type BandName,
} from "@/lib/world-motion";

// Any number, including NaN, +/-Infinity, negatives and zero.
const anyNumber = fc.oneof(
  fc.double({ noNaN: false, noDefaultInfinity: false }),
  fc.constantFrom(
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    0,
    -0,
    -1,
    1,
  ),
  fc.integer({ min: -5000, max: 5000 }),
);

describe("world-motion properties", () => {
  // Feature: explorable-worlds, Property 10: Depth position is total and clamped
  // **Validates: Requirements 5.10, 6.14, 17.9**
  describe("Feature: explorable-worlds, Property 10", () => {
    it("is always in [0, 1] and never NaN", () => {
      fc.assert(
        fc.property(anyNumber, anyNumber, anyNumber, (top, height, client) => {
          const d = depthPosition(top, height, client);
          expect(Number.isNaN(d)).toBe(false);
          expect(d).toBeGreaterThanOrEqual(0);
          expect(d).toBeLessThanOrEqual(1);
        }),
        { numRuns: 200 },
      );
    });

    it("is 0 when the range or clientHeight is not positive", () => {
      fc.assert(
        fc.property(anyNumber, anyNumber, anyNumber, (top, height, client) => {
          const range = height - client;
          if (range <= 0 || client <= 0) {
            expect(depthPosition(top, height, client)).toBe(0);
          }
        }),
        { numRuns: 200 },
      );
    });

    it("clamps scrollTop beyond either end of a valid range", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5000 }),
          fc.integer({ min: 1, max: 5000 }),
          fc.integer({ min: -10000, max: 20000 }),
          (client, extra, top) => {
            const d = depthPosition(top, client + extra, client);
            expect(d).toBeGreaterThanOrEqual(0);
            expect(d).toBeLessThanOrEqual(1);
            if (top <= 0) expect(d).toBe(0);
            if (top >= extra) expect(d).toBe(1);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

const BANDS: BandName[] = ["background", "midground", "creature", "nearMist", "foreground"];
const DECORATIVE: BandName[] = ["background", "midground", "nearMist", "foreground"];

const unit = fc.double({ min: -1, max: 1, noNaN: true });
const finiteScroll = fc.double({ min: -100000, max: 100000, noNaN: true });

describe("world-motion band offsets", () => {
  // Feature: explorable-worlds, Property 11: Band offsets are ordered, additive and zero under reduced motion
  // **Validates: Requirements 5.1, 5.6, 5.8, 7.5, 8.4, 8.5**
  describe("Feature: explorable-worlds, Property 11", () => {
    it("orders the band rates 0 < background < midground < 1 < nearMist < foreground", () => {
      expect(BAND_RATES.creature).toBe(1);
      expect(0).toBeLessThan(BAND_RATES.background);
      expect(BAND_RATES.background).toBeLessThan(BAND_RATES.midground);
      expect(BAND_RATES.midground).toBeLessThan(1);
      expect(1).toBeLessThan(BAND_RATES.nearMist);
      expect(BAND_RATES.nearMist).toBeLessThan(BAND_RATES.foreground);
    });

    it("creature band is zero pointer and zero scroll term", () => {
      fc.assert(
        fc.property(finiteScroll, finiteScroll, unit, unit, (scroll, anchor, px, py) => {
          const o = bandOffset("creature", { px, py, scroll, anchor, reduced: false });
          expect(o.x + 0).toBe(0);
          expect(o.y + 0).toBe(0);
        }),
        { numRuns: 100 },
      );
    });

    it("decorative offsets equal pointer term plus scroll term and are finite", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...DECORATIVE),
          finiteScroll,
          finiteScroll,
          unit,
          unit,
          (band, scroll, anchor, px, py) => {
            const base = { scroll, anchor, reduced: false };
            const full = bandOffset(band, { ...base, px, py });
            const pointerOnly = bandOffset(band, { ...base, scroll: 0, anchor: 0, px, py });
            const scrollOnly = bandOffset(band, { ...base, px: 0, py: 0 });
            expect(Number.isFinite(full.x)).toBe(true);
            expect(Number.isFinite(full.y)).toBe(true);
            expect(full.x).toBeCloseTo(pointerOnly.x + scrollOnly.x, 6);
            expect(full.y).toBeCloseTo(pointerOnly.y + scrollOnly.y, 6);
            // Pointer term stays within the band's parallax budget.
            expect(Math.abs(pointerOnly.x)).toBeLessThanOrEqual(PARALLAX_MAX[band] + 1e-9);
            expect(Math.abs(pointerOnly.y)).toBeLessThanOrEqual(PARALLAX_MAX[band] + 1e-9);
            // Scroll term has no horizontal part.
            expect(scrollOnly.x).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("is zero for every band when reduced motion is on", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...BANDS),
          finiteScroll,
          finiteScroll,
          unit,
          unit,
          (band, scroll, anchor, px, py) => {
            const o = bandOffset(band, { px, py, scroll, anchor, reduced: true });
            expect(o.x).toBe(0);
            expect(o.y).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

// Feature: explorable-worlds, Property 13: A gesture is a tap exactly when it moves 8 px or less
// **Validates: Requirements 4.3, 4.4, 13.8, 13.9**
describe("Feature: explorable-worlds, Property 13", () => {
  const delta = fc.double({ min: -50, max: 50, noNaN: true });

  it("is a tap iff hypot(dx, dy) <= GESTURE_TAP_MAX_PX", () => {
    fc.assert(
      fc.property(delta, delta, (dx, dy) => {
        const expected = Math.hypot(dx, dy) <= GESTURE_TAP_MAX_PX ? "tap" : "scroll";
        expect(classifyGesture(dx, dy)).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it("is symmetric under sign changes and axis swap", () => {
    fc.assert(
      fc.property(delta, delta, (dx, dy) => {
        const base = classifyGesture(dx, dy);
        expect(classifyGesture(-dx, dy)).toBe(base);
        expect(classifyGesture(dx, -dy)).toBe(base);
        expect(classifyGesture(-dx, -dy)).toBe(base);
        expect(classifyGesture(dy, dx)).toBe(base);
      }),
      { numRuns: 200 },
    );
  });

  it("never throws on non-finite inputs and returns a valid class", () => {
    fc.assert(
      fc.property(anyNumber, anyNumber, (dx, dy) => {
        const r = classifyGesture(dx, dy);
        expect(["tap", "scroll"]).toContain(r);
      }),
      { numRuns: 200 },
    );
  });
});
