/**
 * Feature: explorable-worlds, Property 1: World_Length never decreases as the
 * Plot grows
 *
 * **Validates: Requirements 6.1, 17.9**
 */
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { computeWorldLayout, worldColumns, worldLength } from "../../lib/world-layout";
import { arbNames, arbPlace, arbViewport, arbWideViewport } from "./helpers/world-arbitraries";

const RUNS = { numRuns: 150 };

describe("Feature: explorable-worlds, Property 1: World_Length monotonicity", () => {
  it("worldLength of an extended list is >= that of the shorter list", () => {
    fc.assert(
      fc.property(arbPlace, arbViewport, arbNames(12), (place, vp, names) => {
        let prev = -Infinity;
        for (let n = 0; n <= names.length; n++) {
          const len = worldLength(place, n, vp.viewportW, vp.viewportH);
          expect(len).toBeGreaterThanOrEqual(prev);
          prev = len;
        }
      }),
      RUNS,
    );
  });

  it("computeWorldLayout lengthVh is non-decreasing over name prefixes", () => {
    fc.assert(
      fc.property(arbPlace, arbViewport, arbNames(12), (place, vp, names) => {
        let prev = -Infinity;
        for (let n = 0; n <= names.length; n++) {
          const layout = computeWorldLayout({
            place,
            names: names.slice(0, n),
            ...vp,
          });
          expect(layout.lengthVh).toBeGreaterThanOrEqual(prev);
          expect(layout.lengthVh).toBe(
            worldLength(place, n, vp.viewportW, vp.viewportH),
          );
          prev = layout.lengthVh;
        }
      }),
      RUNS,
    );
  });
});

/**
 * Feature: explorable-worlds, Property 2: Zero or one Creature gives exactly
 * one screen
 *
 * **Validates: Requirements 3.10, 6.2, 6.3, 8.10, 9.11, 16.1**
 */
describe("Feature: explorable-worlds, Property 2: zero or one Creature gives one screen", () => {
  const arbZeroOrOne = arbNames(1);

  it("lengthVh is 1, heightPx is the viewport height, one stratum, slots match names", () => {
    fc.assert(
      fc.property(arbPlace, arbViewport, arbZeroOrOne, (place, vp, names) => {
        const layout = computeWorldLayout({ place, names, ...vp });
        expect(layout.lengthVh).toBe(1);
        expect(layout.heightPx).toBe(vp.viewportH);
        expect(layout.viewportH).toBe(vp.viewportH);
        expect(layout.strata).toHaveLength(1);
        expect(layout.slots).toHaveLength(names.length);
        expect(worldLength(place, names.length, vp.viewportW, vp.viewportH)).toBe(1);
      }),
      { numRuns: 150 },
    );
  });

  it("the single Creature sits in the middle 60% of the first screen", () => {
    fc.assert(
      fc.property(arbPlace, arbViewport, arbNames(1).filter((n) => n.length === 1), (place, vp, names) => {
        const layout = computeWorldLayout({ place, names, ...vp });
        const { cy } = layout.slots[0];
        expect(cy).toBeGreaterThanOrEqual(0.2 * layout.heightPx);
        expect(cy).toBeLessThanOrEqual(0.8 * layout.heightPx);
      }),
      { numRuns: 150 },
    );
  });

  it("holds for out-of-range widths and unusable heights (fallback applied)", () => {
    fc.assert(
      fc.property(arbPlace, arbWideViewport, arbZeroOrOne, (place, vp, names) => {
        const layout = computeWorldLayout({ place, names, ...vp });
        expect(layout.lengthVh).toBe(1);
        expect(layout.heightPx).toBeGreaterThan(0);
        expect(layout.strata).toHaveLength(1);
        expect(layout.slots).toHaveLength(names.length);
        if (Number.isFinite(vp.viewportH) && vp.viewportH >= 700) {
          expect(layout.heightPx).toBe(vp.viewportH);
        }
      }),
      { numRuns: 150 },
    );
  });
});

/**
 * Feature: explorable-worlds, Property 3: Small counts stay in 1.25 to 1.5 and
 * large counts stay under the cap
 *
 * **Validates: Requirements 6.4, 6.7, 6.8, 7.2, 8.12, 9.3**
 */
describe("Feature: explorable-worlds, Property 3: length ranges and caps", () => {
  const namesOf = (n: number) => Array.from({ length: n }, (_, i) => `n${i}`);

  it("2-3 creatures in sky/ground and 2-4 coffins in the crypt give lengthVh in [1.25, 1.5]", () => {
    const arbCase = fc.oneof(
      fc.record({
        place: fc.constantFrom<"sky" | "ground">("sky", "ground"),
        count: fc.integer({ min: 2, max: 3 }),
      }),
      fc.record({
        place: fc.constant<"crypt">("crypt"),
        count: fc.integer({ min: 2, max: 4 }),
      }),
    );
    fc.assert(
      fc.property(arbCase, arbViewport, ({ place, count }, vp) => {
        const layout = computeWorldLayout({ place, names: namesOf(count), ...vp });
        expect(layout.lengthVh).toBeGreaterThanOrEqual(1.25);
        expect(layout.lengthVh).toBeLessThanOrEqual(1.5);
        const len = worldLength(place, count, vp.viewportW, vp.viewportH);
        expect(len).toBeGreaterThanOrEqual(1.25);
        expect(len).toBeLessThanOrEqual(1.5);
      }),
      RUNS,
    );
  });

  it("12 creatures stay at or under 3 Vh on desktop and 4 Vh on compact", () => {
    fc.assert(
      fc.property(arbPlace, arbViewport, (place, vp) => {
        const layout = computeWorldLayout({ place, names: namesOf(12), ...vp });
        const cap = vp.viewportW >= 768 ? 3 : 4;
        expect(layout.lengthVh).toBeLessThanOrEqual(cap);
        expect(layout.lengthVh).toBeGreaterThanOrEqual(1);
      }),
      RUNS,
    );
  });

  it("any count 0-12 stays within the mode cap", () => {
    fc.assert(
      fc.property(arbPlace, arbViewport, fc.integer({ min: 0, max: 12 }), (place, vp, count) => {
        const len = worldLength(place, count, vp.viewportW, vp.viewportH);
        expect(len).toBeLessThanOrEqual(vp.viewportW >= 768 ? 3 : 4);
      }),
      RUNS,
    );
  });
});

/**
 * Feature: explorable-worlds, Property 19: Compact column count follows the
 * width rule
 *
 * **Validates: Requirements 13.4**
 */
describe("Feature: explorable-worlds, Property 19: compact column count follows the width rule", () => {
  it("columns equals max(1, min(count, floor((W - 32) / 140))) for widths under 768", () => {
    fc.assert(
      fc.property(
        arbPlace,
        fc.integer({ min: 0, max: 767 }),
        fc.integer({ min: 0, max: 12 }),
        fc.integer({ min: 0, max: 2000 }),
        (place, viewportW, count, viewportH) => {
          const expected = Math.max(
            1,
            Math.min(count, Math.floor((viewportW - 32) / 140)),
          );
          expect(worldColumns(count, viewportW)).toBe(expected);
          const layout = computeWorldLayout({
            place,
            names: Array.from({ length: count }, (_, i) => `n${i}`),
            viewportW,
            viewportH,
          });
          expect(layout.compact).toBe(true);
          expect(layout.columns).toBe(expected);
        },
      ),
      { numRuns: 200 },
    );
  });
});
