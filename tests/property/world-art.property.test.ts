/**
 * Feature: explorable-worlds, Property 15: Crop geometry is uniform, inside the
 * plate, within the upscale limit, and covered by the bleed
 *
 * **Validates: Requirements 7.6, 19.1, 19.2, 19.3, 19.10**
 */
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
  WORLD_ART,
  PLATE_SIZE,
  MAX_UPSCALE,
  REDUCED_OVERSCAN_PX,
  computeCrop,
  plateToStage,
  bleedPx,
} from "../../lib/world-art";
import { PAINTED_MOON } from "../../lib/estate-view";
import { BAND_RATES } from "../../lib/world-motion";

const RUNS = { numRuns: 150 };
const EPS = 1e-6;
const RATES = Object.values(BAND_RATES);

const frac = fc.double({ min: 0, max: 1, noNaN: true });
const dim = fc.integer({ min: 1, max: 4000 });
const plateArb = fc.record({
  w: fc.integer({ min: 16, max: 2400 }),
  h: fc.integer({ min: 16, max: 2400 }),
});

describe("Property 15: crop geometry", () => {
  it("rect is inside the plate, aspect equals the element, scale is uniform", () => {
    fc.assert(
      fc.property(
        plateArb,
        fc.record({ w: dim, h: dim }),
        fc.record({ fx: frac, fy: frac }),
        fc.record({ ax: frac, ay: frac }),
        fc.record({ h: fc.boolean(), v: fc.boolean() }),
        fc.option(
          fc.record({
            x: fc.double({ min: -1, max: 1, noNaN: true }),
            y: fc.double({ min: -1, max: 1, noNaN: true }),
          }),
          { nil: undefined },
        ),
        (plate, element, focal, anchor, flip, offset) => {
          const c = computeCrop({ plate, element, focal, anchor, flip, offset });
          const { x, y, w, h } = c.rect;
          expect(x).toBeGreaterThanOrEqual(-EPS);
          expect(y).toBeGreaterThanOrEqual(-EPS);
          expect(x + w).toBeLessThanOrEqual(plate.w + EPS);
          expect(y + h).toBeLessThanOrEqual(plate.h + EPS);
          expect(w).toBeGreaterThan(0);
          expect(h).toBeGreaterThan(0);
          // Equal horizontal and vertical scale: element = rect * scale.
          expect(Math.abs(w * c.scale - element.w)).toBeLessThan(1e-6 * element.w + EPS);
          expect(Math.abs(h * c.scale - element.h)).toBeLessThan(1e-6 * element.h + EPS);
          expect(c.scale).toBeGreaterThan(0);
        },
      ),
      RUNS,
    );
  });

  it("every WORLD_ART stratum stays within the upscale limit at 1920 px", () => {
    const rate = fc.constantFrom(...RATES);
    fc.assert(
      fc.property(
        fc.integer({ min: 600, max: 1200 }),
        fc.double({ min: 0.5, max: 1, noNaN: true }),
        rate,
        fc.double({ min: 0, max: 8, noNaN: true }),
        fc.constantFrom(...(["sky", "ground", "crypt"] as const)),
        (vh, hsFrac, r, pointer, place) => {
          const hs = hsFrac * vh;
          const blend = 0.15 * vh;
          const b = bleedPx({
            viewportH: vh,
            stratumH: hs,
            blendH: blend,
            rate: r,
            maxPointer: Math.max(8, pointer),
            drift: 12,
            reduced: false,
          });
          const element = { w: 1920 + 2 * b.x, h: hs + blend + 2 * b.y };
          for (const spec of WORLD_ART[place]) {
            const c = computeCrop({
              plate: PLATE_SIZE[spec.plate],
              element,
              focal: spec.focal,
              anchor: spec.anchor,
              flip: spec.flip,
              offset: spec.offset,
            });
            expect(c.upscale).toBeLessThanOrEqual(MAX_UPSCALE);
          }
        },
      ),
      RUNS,
    );
  });

  it("bleed covers the largest stratum-local offset; reduced is exactly 8 px", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 3000 }),
        fc.integer({ min: 0, max: 6000 }),
        fc.integer({ min: 0, max: 600 }),
        fc.constantFrom(...RATES),
        fc.integer({ min: 0, max: 40 }),
        fc.integer({ min: 0, max: 40 }),
        (vh, hs, blend, rate, pointer, drift) => {
          const b = bleedPx({
            viewportH: vh,
            stratumH: hs,
            blendH: blend,
            rate,
            maxPointer: pointer,
            drift,
            reduced: false,
          });
          const maxOffset = (vh + hs + blend) / 2;
          expect(b.y).toBeGreaterThanOrEqual(
            Math.abs(1 - rate) * maxOffset + pointer + drift - EPS,
          );
          expect(b.x).toBeGreaterThanOrEqual(pointer + drift - EPS);
          expect(b.x).toBeGreaterThanOrEqual(REDUCED_OVERSCAN_PX);

          const r = bleedPx({
            viewportH: vh,
            stratumH: hs,
            blendH: blend,
            rate,
            maxPointer: pointer,
            drift,
            reduced: true,
          });
          expect(r).toEqual({ x: 8, y: 8 });
        },
      ),
      RUNS,
    );
  });

  it("plateToStage maps the focal point to the anchor when unclamped, with flips", () => {
    fc.assert(
      fc.property(
        // Middle-ish element and focal so no clamping occurs.
        fc.integer({ min: 100, max: 400 }),
        fc.integer({ min: 100, max: 400 }),
        fc.double({ min: 0.45, max: 0.55, noNaN: true }),
        fc.double({ min: 0.45, max: 0.55, noNaN: true }),
        fc.double({ min: 0.45, max: 0.55, noNaN: true }),
        fc.double({ min: 0.45, max: 0.55, noNaN: true }),
        fc.boolean(),
        fc.boolean(),
        (w, h, fx, fy, ax, ay, fh, fv) => {
          const plate = { w: 1536, h: 1024 };
          const element = { w, h };
          const c = computeCrop({
            plate,
            element,
            focal: { fx, fy },
            anchor: { ax, ay },
            flip: { h: fh, v: fv },
          });
          const p = plateToStage(c, element, fx, fy);
          // Cover fills one axis entirely and clamping can pin the other; only an
          // unclamped axis is required to honour the anchor.
          if (c.rect.x > 1e-6 && c.rect.x < plate.w - c.rect.w - 1e-6) {
            expect(Math.abs(p.x - ax * w)).toBeLessThan(1e-6 * w + 1e-6);
          }
          if (c.rect.y > 1e-6 && c.rect.y < plate.h - c.rect.h - 1e-6) {
            expect(Math.abs(p.y - ay * h)).toBeLessThan(1e-6 * h + 1e-6);
          }
        },
      ),
      RUNS,
    );
  });

  it("the painted moon lands on the high-air anchor", () => {
    const spec = WORLD_ART.sky.find((s) => s.stratumId === "high-air")!;
    expect(spec.focal).toEqual({ fx: PAINTED_MOON.fx, fy: PAINTED_MOON.fy });
    fc.assert(
      fc.property(
        fc.integer({ min: 300, max: 2000 }),
        fc.double({ min: 0.1, max: 0.4, noNaN: true }),
        (w, aspect) => {
          const element = { w, h: w * aspect };
          const c = computeCrop({
            plate: PLATE_SIZE[spec.plate],
            element,
            focal: spec.focal,
            anchor: spec.anchor,
            flip: spec.flip,
          });
          const p = plateToStage(c, element, PAINTED_MOON.fx, PAINTED_MOON.fy);
          expect(Math.abs(p.x - spec.anchor.ax * element.w)).toBeLessThan(1e-6 * w + 1e-6);
          expect(Math.abs(p.y - spec.anchor.ay * element.h)).toBeLessThan(1e-6 * w + 1e-6);
        },
      ),
      RUNS,
    );
  });
});
