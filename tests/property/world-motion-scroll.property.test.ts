import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { ambientBrightness, scrollTargetFor } from "@/lib/world-motion";

// Feature: explorable-worlds, Property 16: Crypt ambient brightness never rises and never drops below 80 percent
// **Validates: Requirements 9.4**
describe("Feature: explorable-worlds, Property 16", () => {
  it("is 1 at depth 0", () => {
    expect(ambientBrightness(0)).toBe(1);
  });

  it("is non-increasing in depth", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (a, b) => {
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          expect(ambientBrightness(hi)).toBeLessThanOrEqual(ambientBrightness(lo));
        },
      ),
      { numRuns: 200 },
    );
  });

  it("stays at or above 0.8 for depth in [0, 1]", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (d) => {
        const v = ambientBrightness(d);
        expect(v).toBeGreaterThanOrEqual(0.8 - 1e-12);
        expect(v).toBeLessThanOrEqual(1);
      }),
      { numRuns: 200 },
    );
  });

  it("is finite and within [0.8, 1] for odd inputs", () => {
    fc.assert(
      fc.property(fc.double(), (d) => {
        const v = ambientBrightness(d);
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0.8 - 1e-12);
        expect(v).toBeLessThanOrEqual(1);
      }),
      { numRuns: 200 },
    );
  });
});

// Feature: explorable-worlds, Property 17: Scrolling to a Creature puts it in the central 60 percent
// **Validates: Requirements 10.5, 10.6**
describe("Feature: explorable-worlds, Property 17", () => {
  const dims = fc.record({
    heightPx: fc.integer({ min: 0, max: 20000 }),
    viewportH: fc.integer({ min: 1, max: 3000 }),
    cy: fc.integer({ min: -2000, max: 22000 }),
  });

  it("target is always within [0, max(0, heightPx - viewportH)]", () => {
    fc.assert(
      fc.property(dims, ({ heightPx, viewportH, cy }) => {
        const t = scrollTargetFor({ cy }, heightPx, viewportH);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(Math.max(0, heightPx - viewportH));
      }),
      { numRuns: 200 },
    );
  });

  it("puts the creature in the central 60% when the centring target is reachable", () => {
    fc.assert(
      fc.property(dims, ({ heightPx, viewportH, cy }) => {
        const unclamped = cy - viewportH / 2;
        const max = Math.max(0, heightPx - viewportH);
        fc.pre(unclamped >= 0 && unclamped <= max);
        const t = scrollTargetFor({ cy }, heightPx, viewportH);
        const onScreen = cy - t;
        expect(onScreen).toBeGreaterThanOrEqual(0.2 * viewportH - 1e-6);
        expect(onScreen).toBeLessThanOrEqual(0.8 * viewportH + 1e-6);
      }),
      { numRuns: 200 },
    );
  });

  it("clamps to the ends when centring is unreachable", () => {
    fc.assert(
      fc.property(dims, ({ heightPx, viewportH, cy }) => {
        const unclamped = cy - viewportH / 2;
        const max = Math.max(0, heightPx - viewportH);
        const t = scrollTargetFor({ cy }, heightPx, viewportH);
        if (unclamped < 0) expect(t).toBe(0);
        if (unclamped > max) expect(t).toBe(max);
      }),
      { numRuns: 200 },
    );
  });

  it("is finite for odd inputs", () => {
    fc.assert(
      fc.property(fc.double(), fc.double(), fc.double(), (cy, h, v) => {
        const t = scrollTargetFor({ cy }, h, v);
        expect(Number.isFinite(t)).toBe(true);
        expect(t).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 },
    );
  });
});
