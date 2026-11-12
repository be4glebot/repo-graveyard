/**
 * Property tests for the compact stack layout's single-row centring.
 *
 * Feature: polish-pass-2e
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  compactStackLayout,
  compactColumns,
  plaqueLiftPx,
  COMPACT_SLOT_GAP_PX,
  COMPACT_CREATURE_MIN_PX,
  CREATURE_BASE_SIZE,
  PLAQUE_H,
  SCATTER_SCALE_MAX,
  SCATTER_SCALE_MIN,
  type ScatterPlacement,
  type StageBandPx,
} from "@/lib/estate-view";

const RUNS = { numRuns: 100 };

const fin = (n: number): number => (Number.isFinite(n) ? n : 0);

function placement(scale: number): ScatterPlacement {
  return {
    x: 0.5,
    y: 0.5,
    scale,
    brightness: 1,
    mirrored: false,
    row: 0,
    tilt: 0,
  } as unknown as ScatterPlacement;
}

const arbScale = fc.double({
  min: SCATTER_SCALE_MIN,
  max: SCATTER_SCALE_MAX,
  noNaN: true,
});
const arbWidth = fc.integer({ min: 280, max: 767 });
const arbBand = fc
  .tuple(fc.integer({ min: 0, max: 300 }), fc.integer({ min: 0, max: 900 }))
  .map(([top, h]): StageBandPx => ({ top, bottom: top + h }));
const arbPlacements = (min: number, max: number) =>
  fc
    .array(arbScale, { minLength: min, maxLength: max })
    .map((ss) => ss.map(placement));

/**
 * Reference copy of the pre-change feet-line computation (the rows > 1 path
 * is what must stay identical). Returns the feet line (px) per row.
 */
function referenceFeet(
  placements: readonly ScatterPlacement[],
  W: number,
  band: StageBandPx,
): { feet: number[]; heights: number[] } {
  const n = placements.length;
  const top = Math.max(0, fin(band.top));
  const bottom = Math.max(top, fin(band.bottom));
  const cols = compactColumns(W);
  const rows = Math.ceil(n / cols);
  const gap = COMPACT_SLOT_GAP_PX;
  const scales = placements.map((p) => {
    const s = fin(p.scale) || 1;
    return Math.min(SCATTER_SCALE_MAX, Math.max(SCATTER_SCALE_MIN, s));
  });
  const maxPlaqueH = PLAQUE_H * SCATTER_SCALE_MAX;
  const worstLift = plaqueLiftPx(CREATURE_BASE_SIZE * SCATTER_SCALE_MAX, maxPlaqueH);
  const bestLift = plaqueLiftPx(
    COMPACT_CREATURE_MIN_PX,
    PLAQUE_H * SCATTER_SCALE_MIN,
  );
  const overhang = Math.max(0, maxPlaqueH / 2 - bestLift);
  const minPitch = maxPlaqueH + gap + Math.max(0, worstLift - bestLift);
  const usable = bottom - overhang - top;
  const maxH = Math.max(COMPACT_CREATURE_MIN_PX, usable - (rows - 1) * minPitch);
  const heights = scales.map((s) => Math.min(CREATURE_BASE_SIZE * s, maxH));
  const up = new Array<number>(rows).fill(0);
  const down = new Array<number>(rows).fill(0);
  const tall = new Array<number>(rows).fill(0);
  for (let i = 0; i < n; i++) {
    const j = Math.floor(i / cols);
    const ph = PLAQUE_H * scales[i];
    const lift = plaqueLiftPx(heights[i], ph);
    up[j] = Math.max(up[j], lift + ph / 2);
    down[j] = Math.max(down[j], ph / 2 - lift);
    tall[j] = Math.max(tall[j], heights[i]);
  }
  const feet = new Array<number>(rows).fill(0);
  feet[0] = top + Math.max(tall[0], up[0]);
  for (let j = 1; j < rows; j++) {
    feet[j] = Math.max(
      feet[j - 1] + Math.max(0, down[j - 1]) + gap + up[j],
      top + Math.max(tall[j], up[j]),
    );
  }
  const lastLimit = bottom - Math.max(0, down[rows - 1]);
  const slack = lastLimit - feet[rows - 1];
  if (slack > 0) {
    for (let j = 1; j < rows; j++) {
      feet[j] += (slack * j) / (rows - 1);
    }
  }
  return { feet, heights };
}

describe("Feature: polish-pass-2e, Property 3: A single compact row is vertically centred", () => {
  it("centres the row extent on the band midpoint unless clamped to the band", () => {
    fc.assert(
      fc.property(arbWidth, arbBand, fc.nat(), (W, band, seed) => {
        const cols = compactColumns(W);
        const n = (seed % cols) + 1;
        const ps = Array.from({ length: n }, (_, i) =>
          placement(SCATTER_SCALE_MIN + ((i * 0.13 + seed * 0.07) % 0.45)),
        );
        const out = compactStackLayout(ps, W, band);
        expect(out).toHaveLength(n);
        const H = Math.max(1, band.bottom);
        const feet = out[0].y * H;
        const extTop = Math.min(
          ...out.flatMap((o) => [o.creature.top, o.plaque.top]),
        );
        const extBottom = Math.max(feet, ...out.map((o) => o.plaque.bottom));
        const mid = (extTop + extBottom) / 2;
        const bandMid = (band.top + band.bottom) / 2;
        const clamped =
          Math.abs(extTop - band.top) <= 1 ||
          Math.abs(extBottom - band.bottom) <= 1;
        expect(Math.abs(mid - bandMid) <= 1 || clamped).toBe(true);
        // When the band is tall enough, nothing leaves it.
        if (extBottom - extTop <= band.bottom - band.top) {
          expect(extTop).toBeGreaterThanOrEqual(band.top - 1);
          expect(extBottom).toBeLessThanOrEqual(band.bottom + 1);
        }
      }),
      RUNS,
    );
  });
});

describe("Feature: polish-pass-2e, Property 4: Multi-row layouts are unchanged", () => {
  it("matches the pre-change feet lines and heights when n > columns", () => {
    fc.assert(
      fc.property(
        arbWidth,
        arbBand,
        arbPlacements(5, 16),
        (W, band, ps) => {
          fc.pre(ps.length > compactColumns(W));
          const cols = compactColumns(W);
          const out = compactStackLayout(ps, W, band);
          const ref = referenceFeet(ps, W, band);
          const H = Math.max(1, Math.max(band.top, band.bottom));
          out.forEach((o, i) => {
            const j = Math.floor(i / cols);
            expect(o.y * H).toBeCloseTo(ref.feet[j], 6);
            expect(o.creatureHeightPx).toBeCloseTo(ref.heights[i], 6);
          });
        },
      ),
      RUNS,
    );
  });
});

describe("Feature: polish-pass-2e, Property 5: Compact layout is total", () => {
  const arbNum = fc.oneof(
    fc.double({ noNaN: false }),
    fc.constantFrom(NaN, Infinity, -Infinity),
    fc.integer({ min: -500, max: 2000 }),
  );

  it("never throws and returns exactly n placements", () => {
    fc.assert(
      fc.property(
        arbNum,
        arbNum,
        arbNum,
        fc.option(arbNum, { nil: undefined }),
        fc.array(fc.oneof(arbScale, arbNum), { maxLength: 14 }),
        (W, bTop, bBottom, sceneH, scales) => {
          const ps = scales.map(placement);
          const out = compactStackLayout(
            ps,
            W,
            { top: bTop, bottom: bBottom },
            sceneH,
          );
          expect(out).toHaveLength(ps.length);
        },
      ),
      RUNS,
    );
  });

  it("returns an empty layout for the empty list", () => {
    expect(compactStackLayout([], 390, { top: 100, bottom: 600 })).toEqual([]);
  });
});
