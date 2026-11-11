import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  COMPACT_CHROME_FALLBACK_PX,
  SCATTER_SCALE_MAX,
  SCATTER_SCALE_MIN,
  SCENE_EDGE_MARGIN_PX,
  compactPlotSize,
  compactStackLayout,
  layoutCompactChrome,
  rectsIntersect,
  stageBand,
  type ScatterPlacement,
  type SceneRect,
} from "@/lib/estate-view";

// Feature: landing-mobile-states, Property 12: Compact creatures and plaques stay inside the stage band
// **Validates: Requirements 5.6, 5.7**

const scale = fc.double({
  min: SCATTER_SCALE_MIN,
  max: SCATTER_SCALE_MAX,
  noNaN: true,
});

const placement = scale.map(
  (s): ScatterPlacement => ({
    x: 0.5,
    y: 0.5,
    scale: s,
    brightness: 1,
    mirrored: false,
    row: 0,
    tilt: 0,
  }),
);

const scenario = fc
  .record({
    width: fc.integer({ min: 375, max: 767 }),
    height: fc.integer({ min: 667, max: 1024 }),
  })
  .chain(({ width, height }) =>
    fc
      .array(placement, { minLength: 0, maxLength: compactPlotSize(width) })
      .map((placements) => ({ width, height, placements })),
  );

/** Shrinks a rect by a float-noise epsilon so edge-touching counts as clear. */
const EPS = 1e-6;
const shrink = (r: SceneRect): SceneRect => ({
  ...r,
  left: r.left + EPS,
  right: r.right - EPS,
  top: r.top + EPS,
  bottom: r.bottom - EPS,
});

describe("Property 12: compactStackLayout stays inside the stage band", () => {
  it("keeps every creature and plaque inside the band, margins and clear of chrome", () => {
    fc.assert(
      fc.property(scenario, ({ width, height, placements }) => {
        const chrome = layoutCompactChrome(width, height, COMPACT_CHROME_FALLBACK_PX);
        const band = stageBand(height, chrome.chips.bottom, chrome.bottomBar.top);
        const out = compactStackLayout(placements, width, band, height);
        expect(out).toHaveLength(placements.length);

        const boxes = Object.values(chrome);
        for (const r of out) {
          for (const rect of [r.creature, r.plaque]) {
            expect(rect.top).toBeGreaterThanOrEqual(band.top - 1e-6);
            expect(rect.bottom).toBeLessThanOrEqual(band.bottom + 1e-6);
            expect(rect.left).toBeGreaterThanOrEqual(SCENE_EDGE_MARGIN_PX - 1e-6);
            expect(rect.right).toBeLessThanOrEqual(width - SCENE_EDGE_MARGIN_PX + 1e-6);
            for (const box of boxes) {
              expect(rectsIntersect(shrink(rect), box)).toBe(false);
            }
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});
