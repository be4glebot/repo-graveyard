/**
 * Feature: explorable-worlds, Property 18: Data-derived details are
 * deterministic functions of real fields.
 *
 * **Validates: Requirements 18.10**
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { freshEarth, ghostLanternLevel } from "@/lib/world-effects";
import { rimFor, RIM_ALPHA_MAX, RIM_ALPHA_MIN } from "@/lib/world-light";
import { LIFECYCLE_CONFIG } from "@/lib/lifecycle";

const RUNS = { numRuns: 200 };

const arbDays = fc.oneof(
  fc.double({ min: -1000, max: 5000, noNaN: true }),
  fc.integer({ min: -10, max: 400 }),
  fc.constantFrom(NaN, Infinity, 0, LIFECYCLE_CONFIG.ghostMaxDaysQuiet, LIFECYCLE_CONFIG.ghostMaxDaysQuiet - 1),
);
const arbDecay = fc.oneof(
  fc.double({ min: -50, max: 50, noNaN: true }),
  fc.integer({ min: -5, max: 10 }),
  fc.constantFrom(NaN, null, undefined, Infinity, -Infinity),
);
const arbPlace = fc.constantFrom("sky", "ground", "crypt" as const) as fc.Arbitrary<"sky" | "ground" | "crypt">;

describe("Feature: explorable-worlds, Property 18", () => {
  it("freshEarth is a deterministic boolean driven only by the active threshold", () => {
    fc.assert(
      fc.property(arbDays, (d) => {
        const r = freshEarth(d);
        expect(typeof r).toBe("boolean");
        expect(freshEarth(d)).toBe(r);
        if (Number.isNaN(d) || d === Infinity) expect(r).toBe(false);
        else expect(r).toBe(d < LIFECYCLE_CONFIG.ghostMaxDaysQuiet);
      }),
      RUNS,
    );
  });

  it("freshEarth is monotone: true for d1 implies true for any 0 <= d2 <= d1", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 5000, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), (d1, f) => {
        const d2 = d1 * f;
        if (freshEarth(d1)) expect(freshEarth(d2)).toBe(true);
      }),
      RUNS,
    );
  });

  it("freshEarth is false for missing or non-numeric input", () => {
    expect(freshEarth(undefined as unknown as number)).toBe(false);
    expect(freshEarth(null as unknown as number)).toBe(false);
    expect(freshEarth(NaN)).toBe(false);
    expect(freshEarth(Infinity)).toBe(false);
  });

  it("ghostLanternLevel is a deterministic integer in 0..3", () => {
    fc.assert(
      fc.property(arbDecay, (lvl) => {
        const r = ghostLanternLevel(lvl as number | null | undefined);
        expect(Number.isInteger(r)).toBe(true);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(LIFECYCLE_CONFIG.ghostDecayBounds.length);
        expect(ghostLanternLevel(lvl as number | null | undefined)).toBe(r);
      }),
      RUNS,
    );
  });

  it("ghostLanternLevel is monotone in decayLevel and uses only that field", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -20, max: 20, noNaN: true }),
        fc.double({ min: -20, max: 20, noNaN: true }),
        (a, b) => {
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          expect(ghostLanternLevel(lo)).toBeLessThanOrEqual(ghostLanternLevel(hi));
        },
      ),
      RUNS,
    );
    expect(ghostLanternLevel(null)).toBe(0);
    expect(ghostLanternLevel(undefined)).toBe(0);
    expect(ghostLanternLevel(NaN)).toBe(0);
    expect(ghostLanternLevel(99)).toBe(LIFECYCLE_CONFIG.ghostDecayBounds.length);
  });

  it("rimFor depends only on daysQuiet: deterministic, in range, never brighter with more quiet", () => {
    fc.assert(
      fc.property(
        arbPlace,
        fc.oneof(fc.double({ min: -100, max: 1000, noNaN: true }), fc.constantFrom(NaN, null, undefined, Infinity)),
        fc.double({ min: 0, max: 1000, noNaN: true }),
        (place, d, extra) => {
          const row = { daysQuiet: d as number | null | undefined };
          const r = rimFor(place, row);
          expect(rimFor(place, { daysQuiet: d as number | null | undefined, ...({ other: extra } as object) })).toEqual(r);
          expect(Number.isFinite(r.alpha)).toBe(true);
          expect(r.alpha).toBeGreaterThanOrEqual(RIM_ALPHA_MIN - 1e-9);
          expect(r.alpha).toBeLessThanOrEqual(RIM_ALPHA_MAX + 1e-9);
          if (typeof d === "number" && Number.isFinite(d)) {
            expect(rimFor(place, { daysQuiet: d + extra }).alpha).toBeLessThanOrEqual(r.alpha + 1e-9);
          }
        },
      ),
      RUNS,
    );
    expect(rimFor("sky", null).alpha).toBeCloseTo(RIM_ALPHA_MIN);
    expect(rimFor("sky", {}).alpha).toBeCloseTo(RIM_ALPHA_MIN);
  });
});
