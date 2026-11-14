/**
 * Shared fast-check generators for the explorable-worlds property tests.
 * Supported domain: 360 <= W <= 1920, Vh >= 700, names unique, 0 to 12.
 */
import * as fc from "fast-check";
import type { WorldPlace } from "../../../lib/world-layout";

export const arbPlace: fc.Arbitrary<WorldPlace> = fc.constantFrom<WorldPlace>(
  "sky",
  "ground",
  "crypt",
);

/** Duplicate-free list of 0 to `max` arbitrary names (empty string allowed). */
export function arbNames(max = 12): fc.Arbitrary<string[]> {
  return fc.uniqueArray(fc.string({ maxLength: 20 }), { minLength: 0, maxLength: max });
}

export interface Viewport {
  viewportW: number;
  viewportH: number;
}

/** Supported viewport: 360-1920 wide, 700-1800 tall. */
export const arbViewport: fc.Arbitrary<Viewport> = fc.record({
  viewportW: fc.integer({ min: 360, max: 1920 }),
  viewportH: fc.integer({ min: 700, max: 1800 }),
});

/** Wider domain including out-of-range widths and unusable heights. */
export const arbWideViewport: fc.Arbitrary<Viewport> = fc.record({
  viewportW: fc.integer({ min: 200, max: 2600 }),
  viewportH: fc.oneof(
    fc.integer({ min: 0, max: 1800 }),
    fc.constantFrom(Number.NaN, -1, -500),
  ),
});

/**
 * Browser-zoom extremes (task 22.1): CSS viewports from 200x150 (zoom-in 500%)
 * up to 6000x4000 (zoom-out 25% on a large display). Added alongside, never
 * replacing, the supported-domain arbitraries above.
 */
export const arbExtremeViewport: fc.Arbitrary<Viewport> = fc.record({
  viewportW: fc.integer({ min: 200, max: 6000 }),
  viewportH: fc.integer({ min: 150, max: 4000 }),
});
