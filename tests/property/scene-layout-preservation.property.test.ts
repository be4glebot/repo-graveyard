/**
 * Preservation property tests for the scene-layout-clickability bugfix (task 2).
 *
 * Observation-first: the baselines below were recorded from the UNFIXED
 * `scatterLayout` for a full plot (12 names, 4 per row) in every place. They
 * must keep passing before AND after the fix (fix touches only partial rows,
 * stage-band y values, and the top limit).
 *
 * **Validates: Requirements 3.2, 3.4, 3.5**
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  DEPTH_ROWS,
  MAX_SCATTER_COLS,
  PLACE_ORDER,
  PLAQUE_H,
  PLAQUE_W,
  SCENE_EDGE_MARGIN_PX,
  rectsIntersect,
  resolvePlacement,
  scatterLayout,
  type PlaceId,
  type SceneRect,
} from "@/lib/estate-view";

const FULL_NAMES = Array.from(
  { length: 12 },
  (_, i) => `repo-${String.fromCharCode(97 + i)}${i}`,
);

/** [x, scale, brightness, mirrored, row] observed on unfixed code. */
type Baseline = [number, number, number, boolean, number];

const BASELINE: Record<PlaceId, Baseline[]> = {
  sky: [
    [0.109248, 1.108731, 0.931541, true, 2],
    [0.318329, 1.112469, 1.057886, false, 2],
    [0.521031, 1.045905, 0.930209, false, 2],
    [0.748401, 1.057265, 1.021249, true, 2],
    [0.228529, 0.875046, 0.786198, false, 1],
    [0.464324, 0.954237, 0.801228, true, 1],
    [0.646292, 0.951864, 0.777778, false, 1],
    [0.89178, 0.978933, 0.75999, false, 1],
    [0.077961, 0.72538, 0.675447, false, 0],
    [0.35902, 0.81698, 0.602811, false, 0],
    [0.580191, 0.773925, 0.651641, true, 0],
    [0.813554, 0.736187, 0.603869, false, 0],
  ],
  gate: [
    [0.108542, 1.077597, 0.962241, false, 2],
    [0.366343, 1.085859, 0.976267, true, 2],
    [0.538337, 1.026923, 1.022241, true, 2],
    [0.813181, 1.133691, 1.003482, false, 2],
    [0.192494, 0.949875, 0.82263, false, 1],
    [0.423429, 0.938055, 0.782696, false, 1],
    [0.655764, 0.865369, 0.768967, true, 1],
    [0.916271, 0.926489, 0.822132, false, 1],
    [0.083389, 0.729887, 0.576431, true, 0],
    [0.366356, 0.777819, 0.623354, false, 0],
    [0.572172, 0.746782, 0.591508, false, 0],
    [0.756459, 0.82831, 0.651259, false, 0],
  ],
  ground: [
    [0.131267, 1.120943, 0.987254, true, 2],
    [0.335172, 1.069766, 1.001293, true, 2],
    [0.54784, 1.060743, 1.017346, false, 2],
    [0.755214, 1.029538, 1.032048, false, 2],
    [0.192554, 0.967229, 0.785615, false, 1],
    [0.415006, 0.876092, 0.821694, false, 1],
    [0.672353, 0.938703, 0.833364, true, 1],
    [0.881165, 0.962487, 0.810096, true, 1],
    [0.145683, 0.802855, 0.574906, false, 0],
    [0.302959, 0.724694, 0.623278, false, 0],
    [0.555478, 0.769834, 0.602193, false, 0],
    [0.804525, 0.722035, 0.624537, false, 0],
  ],
  crypt: [
    [0.094842, 1.035514, 1.065878, true, 2],
    [0.367896, 1.064344, 0.982158, false, 2],
    [0.555139, 1.042693, 0.996305, false, 2],
    [0.758913, 1.095629, 0.997128, true, 2],
    [0.186942, 0.870918, 0.841571, false, 1],
    [0.477222, 0.918694, 0.760855, false, 1],
    [0.687993, 0.899447, 0.891217, true, 1],
    [0.857191, 0.912756, 0.819508, false, 1],
    [0.108463, 0.720586, 0.594249, true, 0],
    [0.327221, 0.765336, 0.663392, false, 0],
    [0.580412, 0.825415, 0.597224, false, 0],
    [0.771545, 0.799016, 0.683877, false, 0],
  ],
};

const arbPlace: fc.Arbitrary<PlaceId> = fc.constantFrom(...PLACE_ORDER);
const arbNames = (min: number, max: number) =>
  fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9-]{0,14}$/), {
    minLength: min,
    maxLength: max,
  });
const arbViewport = fc.constantFrom(
  { w: 1440, h: 900 },
  { w: 1280, h: 720 },
);

describe("Property 2: Preservation - scatterLayout full-row baselines", () => {
  it.each(PLACE_ORDER)("full 12-name plot in %s matches the observed baseline", (place) => {
    const layout = scatterLayout(FULL_NAMES, DEPTH_ROWS, place, place);
    expect(layout).toHaveLength(12);
    layout.forEach((rec, i) => {
      const [x, scale, brightness, mirrored, row] = BASELINE[place][i];
      expect(rec.x).toBeCloseTo(x, 5);
      expect(rec.scale).toBeCloseTo(scale, 5);
      expect(rec.brightness).toBeCloseTo(brightness, 5);
      expect(rec.mirrored).toBe(mirrored);
      expect(rec.row).toBe(row);
    });
  });

  it("full plots keep the staggered 4-column grid (x within jitter of cell centre)", () => {
    fc.assert(
      fc.property(arbNames(12, 12), arbPlace, (names, place) => {
        const layout = scatterLayout(names, DEPTH_ROWS, place, place);
        const colInRow: Record<number, number> = {};
        layout.forEach((rec) => {
          const col = (colInRow[rec.row] = (colInRow[rec.row] ?? -1) + 1);
          expect(col).toBeLessThan(MAX_SCATTER_COLS);
          const centre = (col + 0.5 + (rec.row % 2) * 0.5) / (MAX_SCATTER_COLS + 0.5);
          // jitter is bounded well under half a cell pitch
          expect(Math.abs(rec.x - centre)).toBeLessThan(0.5 / (MAX_SCATTER_COLS + 0.5));
        });
        for (let r = 0; r < DEPTH_ROWS; r++) expect(colInRow[r]).toBe(MAX_SCATTER_COLS - 1);
      }),
      { numRuns: 60 },
    );
  });
});

describe("Property 2: Preservation - scatterLayout invariants for any plot size", () => {
  it("is deterministic with one record per name in input order", () => {
    fc.assert(
      fc.property(arbNames(1, 12), arbPlace, (names, place) => {
        const a = scatterLayout(names, DEPTH_ROWS, place, place);
        const b = scatterLayout([...names], DEPTH_ROWS, place, place);
        expect(a).toEqual(b);
        expect(a).toHaveLength(names.length);
      }),
      { numRuns: 80 },
    );
  });

  it("marks exactly round(n / 3) records mirrored", () => {
    fc.assert(
      fc.property(arbNames(1, 12), arbPlace, (names, place) => {
        const layout = scatterLayout(names, DEPTH_ROWS, place, place);
        expect(layout.filter((r) => r.mirrored)).toHaveLength(Math.round(names.length / 3));
      }),
      { numRuns: 80 },
    );
  });

  it("orders scale and brightness strictly front > middle > back across rows", () => {
    fc.assert(
      fc.property(arbNames(1, 12), arbPlace, (names, place) => {
        const layout = scatterLayout(names, DEPTH_ROWS, place, place);
        for (const a of layout) {
          for (const b of layout) {
            if (a.row > b.row) {
              expect(a.scale).toBeGreaterThan(b.scale);
              expect(a.brightness).toBeGreaterThan(b.brightness);
            }
          }
        }
      }),
      { numRuns: 80 },
    );
  });
});

describe("Property 2: Preservation - plaque no-overlap and 16px edge margins", () => {
  it("no two plaques overlap and all rects stay inside the margins at 1440x900 and 1280x720", () => {
    fc.assert(
      fc.property(arbNames(1, 12), arbPlace, arbViewport, (names, place, { w, h }) => {
        const pls = scatterLayout(names, DEPTH_ROWS, place, place);
        const order = pls.map((_, i) => i).sort((a, b) => pls[b].row - pls[a].row);
        const obstacles: SceneRect[] = [];
        const plaques: SceneRect[] = [];
        for (const i of order) {
          const r = resolvePlacement(pls[i], place, w, h, obstacles);
          const c = r.creature;
          const upper: SceneRect = { ...c, bottom: c.top + (c.bottom - c.top) * 0.6 };
          obstacles.push(r.plaque, upper);
          plaques.push(r.plaque);
          for (const rect of [r.plaque, r.creature]) {
            expect(rect.left).toBeGreaterThanOrEqual(SCENE_EDGE_MARGIN_PX - 1e-6);
            expect(rect.right).toBeLessThanOrEqual(w - SCENE_EDGE_MARGIN_PX + 1e-6);
          }
          expect(r.plaque.right - r.plaque.left).toBeLessThanOrEqual(PLAQUE_W * 1.15 + 1e-6);
          expect(r.plaque.bottom - r.plaque.top).toBeLessThanOrEqual(PLAQUE_H * 1.15 + 1e-6);
        }
        for (let i = 0; i < plaques.length; i++) {
          for (let j = i + 1; j < plaques.length; j++) {
            expect(rectsIntersect(plaques[i], plaques[j])).toBe(false);
          }
        }
      }),
      { numRuns: 80 },
    );
  });
});
