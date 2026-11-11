/**
 * Feature: landing-mobile-states, Property 13: Compact plaque rects never intersect each other
 */
import { describe, it } from "vitest";
import * as fc from "fast-check";

import {
  SCATTER_SCALE_MAX,
  SCATTER_SCALE_MIN,
  compactPlotSize,
  compactStackLayout,
  rectsIntersect,
  stageBand,
  type ScatterPlacement,
  type SceneRect,
} from "@/lib/estate-view";

const TOL = 1e-6;

/** Shrinks a rect by the tolerance so edge-touch / float noise never counts. */
const shrink = (r: SceneRect): SceneRect => ({
  ...r,
  left: r.left + TOL,
  right: r.right - TOL,
  top: r.top + TOL,
  bottom: r.bottom - TOL,
});

describe("Feature: landing-mobile-states, Property 13: Compact plaque rects never intersect each other", () => {
  it("plaque rects never pairwise intersect for widths 375-767, heights 667-1024", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 375, max: 767 }),
        fc.integer({ min: 667, max: 1024 }),
        fc.nat(),
        fc.array(
          fc.double({ min: SCATTER_SCALE_MIN, max: SCATTER_SCALE_MAX, noNaN: true }),
          { minLength: 1, maxLength: 12 },
        ),
        (width, height, countSeed, scales) => {
          const max = compactPlotSize(width);
          const count = Math.min(scales.length, 1 + (countSeed % max));
          const placements = scales.slice(0, count).map(
            (scale, i) =>
              ({
                x: 0.5,
                y: 0.5,
                scale,
                brightness: 1,
                mirrored: false,
                tilt: 0,
                row: i % 3,
                col: 0,
              }) as unknown as ScatterPlacement,
          );
          const band = stageBand(height, 260, height - 64);
          const out = compactStackLayout(placements, width, band, height);
          for (let i = 0; i < out.length; i++) {
            for (let j = i + 1; j < out.length; j++) {
              if (rectsIntersect(shrink(out[i].plaque), shrink(out[j].plaque))) {
                return false;
              }
            }
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });
});
