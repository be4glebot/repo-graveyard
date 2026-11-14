/**
 * Feature: explorable-worlds, Property 4: No long blank stretches
 *
 * **Validates: Requirements 6.5**
 */
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { computeWorldLayout, WORLD_CONFIG, type Rect } from "../../lib/world-layout";
import { arbNames, arbPlace, arbViewport, arbWideViewport } from "./helpers/world-arbitraries";

describe("Feature: explorable-worlds, Property 4: No long blank stretches", () => {
  it("consecutive items among top, slot centres, features and bottom are <= 0.6 Vh apart", () => {
    fc.assert(
      fc.property(arbPlace, arbViewport, arbNames(12), (place, vp, names) => {
        const layout = computeWorldLayout({ place, names, ...vp });
        if (!(layout.lengthVh > 1)) return;
        const ys = [
          0,
          ...layout.slots.map((s) => s.cy),
          ...layout.features.map((f) => f.y),
          layout.heightPx,
        ].sort((a, b) => a - b);
        const limit = 0.6 * vp.viewportH;
        for (let i = 0; i + 1 < ys.length; i++) {
          expect(ys[i + 1] - ys[i]).toBeLessThanOrEqual(limit + 1e-6);
        }
      }),
      { numRuns: 200 },
    );
  });
});

/**
 * Feature: explorable-worlds, Property 5: Placement covers the first screen and the rest of the world
 *
 * **Validates: Requirements 6.6, 7.2, 7.11, 8.11, 9.3, 16.8**
 */
describe("Feature: explorable-worlds, Property 5: Placement covers the first screen and the rest of the world", () => {
  it("2+ names with lengthVh > 1: a slot in the first screen, a slot or feature below it, one slot per name", () => {
    fc.assert(
      fc.property(
        arbPlace,
        arbViewport,
        arbNames(12).filter((n) => n.length >= 2),
        (place, vp, names) => {
          const layout = computeWorldLayout({ place, names, ...vp });
          expect(layout.slots.length).toBe(names.length);
          if (!(layout.lengthVh > 1)) return;
          const vh = layout.viewportH;
          expect(layout.slots.some((s) => s.cy <= vh + 1e-6)).toBe(true);
          const below =
            layout.slots.some((s) => s.cy > vh) || layout.features.some((f) => f.y > vh);
          expect(below).toBe(true);
          // Small counts: a slot (not only a feature) is below the first screen.
          const small =
            (place === "sky" && names.length <= 3) || (place === "crypt" && names.length <= 4);
          if (small) {
            expect(layout.slots.some((s) => s.cy > vh)).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("a single name is centred horizontally and sits in the middle 60 percent of the first screen", () => {
    fc.assert(
      fc.property(arbPlace, arbViewport, arbNames(1).filter((n) => n.length === 1), (place, vp, names) => {
        const layout = computeWorldLayout({ place, names, ...vp });
        expect(layout.slots.length).toBe(1);
        const s = layout.slots[0];
        expect(Math.abs(s.cx - vp.viewportW / 2)).toBeLessThanOrEqual(0.05 * vp.viewportW + 1e-6);
        expect(s.cy).toBeGreaterThanOrEqual(0.2 * layout.viewportH - 1e-6);
        expect(s.cy).toBeLessThanOrEqual(0.8 * layout.viewportH + 1e-6);
      }),
      { numRuns: 100 },
    );
  });

  it("sky with more than 4 creatures puts a creature in every stratum", () => {
    fc.assert(
      fc.property(
        arbViewport,
        arbNames(12).filter((n) => n.length > 4),
        (vp, names) => {
          const layout = computeWorldLayout({ place: "sky", names, ...vp });
          for (let i = 0; i < layout.strata.length; i++) {
            expect(layout.slots.some((s) => s.stratum === i)).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

/**
 * Feature: explorable-worlds, Property 6: Everything stays inside the world and clear of the chrome
 *
 * **Validates: Requirements 3.3, 6.9, 11.4, 13.6, 16.9, 16.10, 16.11, 16.12**
 */
describe("Feature: explorable-worlds, Property 6: Everything stays inside the world and clear of the chrome", () => {
  const SIDE = WORLD_CONFIG.SIDE_MARGIN;
  const B = WORLD_CONFIG.SLOT_EDGE;
  const rectNums = (r: Rect) => [r.left, r.top, r.right, r.bottom, r.cx, r.cy];

  it("rects are finite and inside the world; slot centres clear the chrome on supported viewports", () => {
    fc.assert(
      fc.property(arbPlace, arbWideViewport, arbNames(12), (place, vp, names) => {
        const layout = computeWorldLayout({ place, names, ...vp });
        const W = vp.viewportW;
        const eps = 1e-6;
        expect(layout.slots.length).toBe(names.length);
        expect(Number.isNaN(layout.lengthVh)).toBe(false);
        expect(Number.isFinite(layout.heightPx)).toBe(true);

        const cfg = layout.compact ? WORLD_CONFIG.compact : WORLD_CONFIG.desktop;
        const supported = W >= 360 && W <= 1920 && layout.viewportH >= 700;

        for (const s of layout.slots) {
          for (const n of [s.cx, s.cy, s.size, ...rectNums(s.body), ...rectNums(s.plaque)]) {
            expect(Number.isFinite(n)).toBe(true);
          }
          for (const r of [s.body, s.plaque]) {
            // Horizontal: only where the width allows the rect inside the margins.
            if (r.right - r.left <= W - 2 * SIDE) {
              expect(r.left).toBeGreaterThanOrEqual(SIDE - eps);
              expect(r.right).toBeLessThanOrEqual(W - SIDE + eps);
            }
            expect(r.top).toBeGreaterThanOrEqual(-eps);
            expect(r.bottom).toBeLessThanOrEqual(layout.heightPx + eps);
          }
          if (supported) {
            expect(s.cy).toBeGreaterThanOrEqual(cfg.TOP_CLEAR + B - eps);
            expect(s.cy).toBeLessThanOrEqual(layout.heightPx - cfg.BOTTOM_CLEAR - B + eps);
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});

/**
 * Feature: explorable-worlds, Property 7: Plaque rectangles never overlap
 *
 * **Validates: Requirements 6.10**
 */
describe("Feature: explorable-worlds, Property 7: Plaque rectangles never overlap", () => {
  it("no two slot.plaque rectangles share interior area", () => {
    fc.assert(
      fc.property(arbPlace, arbViewport, arbNames(12), (place, vp, names) => {
        const layout = computeWorldLayout({ place, names, ...vp });
        const eps = 1e-6;
        const s = layout.slots;
        for (let i = 0; i < s.length; i++) {
          for (let j = i + 1; j < s.length; j++) {
            const a = s[i].plaque;
            const b = s[j].plaque;
            const overlaps =
              a.left < b.right - eps &&
              b.left < a.right - eps &&
              a.top < b.bottom - eps &&
              b.top < a.bottom - eps;
            expect(overlaps).toBe(false);
          }
        }
      }),
      { numRuns: 300 },
    );
  });
});
