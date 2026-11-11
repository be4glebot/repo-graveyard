import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { stageBand, PLAQUE_BELOW_FEET_MAX_PX } from "@/lib/estate-view";

// Feature: landing-mobile-states, Property 10: Stage band tracks the measured limits
// **Validates: Requirements 5.5, 5.9**

const feasible = fc
  .tuple(
    fc.integer({ min: 0, max: 4000 }),
    fc.integer({ min: 0, max: 4000 }),
    fc.integer({ min: 0, max: 4000 }),
  )
  .map(([a, b, c]) => {
    const [top, bar, h] = [a, b, c].sort((x, y) => x - y);
    return { top, bar, h };
  });

const expectedBottom = (top: number, bar: number, h: number) =>
  Math.min(h, Math.max(top, bar - PLAQUE_BELOW_FEET_MAX_PX));

describe("Property 10: stage band tracks the measured limits", () => {
  it("top equals the top-chrome bottom; bottom equals bar top minus the plaque overhang (clamped)", () => {
    fc.assert(
      fc.property(feasible, ({ top, bar, h }) => {
        const band = stageBand(h, top, bar);
        expect(band.top).toBe(top);
        expect(band.bottom).toBe(expectedBottom(top, bar, h));
        expect(band.bottom).toBeGreaterThanOrEqual(band.top);
        expect(band.bottom).toBeLessThanOrEqual(h);
      }),
      { numRuns: 200 },
    );
  });

  it("raising the top limit or lowering the bar top never increases band height", () => {
    fc.assert(
      fc.property(
        feasible,
        fc.integer({ min: 0, max: 1000 }),
        ({ top, bar, h }, delta) => {
          const height = (t: number, b: number) => {
            const s = stageBand(h, t, b);
            return s.bottom - s.top;
          };
          const base = height(top, bar);
          expect(height(Math.min(bar, top + delta), bar)).toBeLessThanOrEqual(base);
          expect(height(top, Math.max(top, bar - delta))).toBeLessThanOrEqual(base);
        },
      ),
      { numRuns: 200 },
    );
  });
});
