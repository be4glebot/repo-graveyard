import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { stageBand } from "@/lib/estate-view";

// Feature: landing-mobile-states, Property 9: Stage band is total, non-negative and inside the scene
describe("stageBand totality", () => {
  it("is total, non-negative and inside the scene", () => {
    // **Validates: Requirements 5.9, 5.10**
    const num = fc.oneof(
      fc.double({ noNaN: false }),
      fc.constantFrom(NaN, Infinity, -Infinity, 0, -0),
      fc.integer({ min: -2000, max: 4000 }),
    );
    fc.assert(
      fc.property(num, num, num, (h, top, bar) => {
        const band = stageBand(h, top, bar);
        expect(Number.isFinite(band.top)).toBe(true);
        expect(Number.isFinite(band.bottom)).toBe(true);
        const maxH = Math.max(0, Number.isFinite(h) ? h : 0);
        expect(band.top).toBeGreaterThanOrEqual(0);
        expect(band.top).toBeLessThanOrEqual(band.bottom);
        expect(band.bottom).toBeLessThanOrEqual(maxH);
      }),
      { numRuns: 300 },
    );
  });
});
