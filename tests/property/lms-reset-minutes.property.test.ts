import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { resetInMinutes } from "@/lib/edge-states";

// Feature: landing-mobile-states, Property 5: Reset countdown rounds up and has a minimum of one
// **Validates: Requirements 7.3**

const MIN_MS = Date.UTC(2000, 0, 1);
const MAX_MS = Date.UTC(2100, 0, 1);
const instant = fc
  .integer({ min: MIN_MS, max: MAX_MS })
  .map((ms) => new Date(ms).toISOString());

describe("Property 5: resetInMinutes", () => {
  it("returns an integer >= 1, rounding up when reset is later than now", () => {
    fc.assert(
      fc.property(instant, instant, (resetAt, now) => {
        const m = resetInMinutes(resetAt, now);
        expect(m).toBeDefined();
        expect(Number.isInteger(m)).toBe(true);
        expect(m!).toBeGreaterThanOrEqual(1);
        const diff = Date.parse(resetAt) - Date.parse(now);
        if (diff > 0) {
          expect(m! * 60000).toBeGreaterThanOrEqual(diff);
          expect((m! - 1) * 60000).toBeLessThan(diff);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("returns undefined for null or unparseable inputs", () => {
    const bad = fc.constantFrom("", "not a date", "soon", "NaN");
    fc.assert(
      fc.property(instant, bad, (valid, invalid) => {
        expect(resetInMinutes(null, valid)).toBeUndefined();
        expect(resetInMinutes(invalid, valid)).toBeUndefined();
        expect(resetInMinutes(valid, invalid)).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });
});
