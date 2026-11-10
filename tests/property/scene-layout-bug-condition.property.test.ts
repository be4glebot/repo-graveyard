/**
 * Bug condition exploration (scene-layout-clickability, task 1, tests (a) + (c)).
 *
 * These tests encode the EXPECTED behavior and are EXPECTED TO FAIL on the
 * unfixed code; the failure confirms the bug:
 *
 *   (a) every creature rect and plaque rect sits at `top >= sceneH / 3` and
 *       outside the place chrome rect (union of `place-chrome` and
 *       `place-title-block`);
 *   (c) for n >= 2 creatures in a non-full plot the horizontal spread
 *       (max x - min x) is at least 40% of the usable width.
 *
 * The geometry mirrors exactly how `DepthScatter` consumes the pure helpers:
 * `scatterLayout` then `resolvePlacement`, front rows first, accumulating
 * plaque + upper-60% creature obstacles.
 *
 * **Validates: Requirements 1.2, 1.3, 2.2, 2.3**
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  DEPTH_ROWS,
  MAX_SCATTER_COLS,
  PLACE_ORDER,
  SCENE_EDGE_MARGIN_PX,
  rectsIntersect,
  resolvePlacement,
  scatterLayout,
  type PlaceId,
  type ResolvedPlacement,
  type SceneRect,
} from "@/lib/estate-view";

/** Viewports from the bug report. The scatter box is the viewport minus px-6. */
const VIEWPORTS = [
  { vw: 1440, vh: 900 },
  { vw: 1280, vh: 720 },
] as const;

/** `--site-header-h` is 7rem. */
const HEADER_H = 112;
/** Approximate bottom of the title block (heading + subtitle + chips). */
const TITLE_BLOCK_BOTTOM = HEADER_H + 150;

/** Chrome rect (scene px): full-width title block, which contains the Return row. */
function chromeRect(sceneW: number): SceneRect {
  return {
    cx: sceneW / 2,
    cy: (HEADER_H + TITLE_BLOCK_BOTTOM) / 2,
    left: 0,
    right: sceneW,
    top: HEADER_H,
    bottom: TITLE_BLOCK_BOTTOM,
  };
}

/** Same resolution loop as DepthScatter (desktop, measured branch). */
function resolveAll(
  names: string[],
  place: PlaceId,
  sceneW: number,
  sceneH: number,
  topLimitPx = 0,
): ResolvedPlacement[] {
  const placements = scatterLayout(names, DEPTH_ROWS, place, place);
  const order = names
    .map((_, i) => i)
    .sort((a, b) => placements[b].row - placements[a].row);
  const obstacles: SceneRect[] = [];
  const out: ResolvedPlacement[] = new Array(names.length);
  for (const i of order) {
    const r = resolvePlacement(placements[i], place, sceneW, sceneH, obstacles, topLimitPx);
    obstacles.push(r.plaque, {
      ...r.creature,
      bottom: r.creature.top + (r.creature.bottom - r.creature.top) * 0.6,
    });
    out[i] = r;
  }
  return out;
}

const arbNames = (min: number, max: number) =>
  fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9-]{2,14}$/), {
    minLength: min,
    maxLength: max,
  });
const arbPlace = fc.constantFrom<PlaceId>(...PLACE_ORDER);
const arbViewport = fc.constantFrom(...VIEWPORTS);

describe("Bug condition: creatures below the top third and clear of the chrome", () => {
  it("(a) every creature and plaque rect has top >= sceneH/3 and avoids the chrome rect", () => {
    fc.assert(
      fc.property(arbPlace, arbViewport, arbNames(1, 12), (place, vp, names) => {
        const sceneW = vp.vw - 48;
        const sceneH = vp.vh;
        const chrome = chromeRect(sceneW);
        const resolved = resolveAll(names, place, sceneW, sceneH, Math.max(sceneH / 3, chrome.bottom));
        for (const r of resolved) {
          expect(r.creature.top).toBeGreaterThanOrEqual(sceneH / 3);
          expect(r.plaque.top).toBeGreaterThanOrEqual(sceneH / 3);
          expect(rectsIntersect(r.creature, chrome)).toBe(false);
          expect(rectsIntersect(r.plaque, chrome)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

});

describe("Bug condition: small plots spread across the full width", () => {
  it("(c) for n = 2..3 the x spread is >= 40% of the usable width", () => {
    // n < MAX_SCATTER_COLS guarantees no row is full.
    expect(MAX_SCATTER_COLS).toBe(4);
    fc.assert(
      fc.property(arbPlace, arbViewport, arbNames(2, 3), (place, vp, names) => {
        const sceneW = vp.vw - 48;
        const usable = sceneW - 2 * SCENE_EDGE_MARGIN_PX;
        const xs = resolveAll(names, place, sceneW, vp.vh).map((r) => r.x * sceneW);
        const spread = Math.max(...xs) - Math.min(...xs);
        expect(spread).toBeGreaterThanOrEqual(0.4 * usable);
      }),
      { numRuns: 100 },
    );
  });

  it("(c) three creatures at 1440x900 are not all packed at x < 400", () => {
    const xs = resolveAll(["a-repo", "b-repo", "c-repo"], "sky", 1392, 900).map(
      (r) => r.x * 1392,
    );
    expect(xs.every((x) => x < 400)).toBe(false);
  });
});
