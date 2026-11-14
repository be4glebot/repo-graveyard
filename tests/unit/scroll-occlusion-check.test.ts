/**
 * Unit tests for the pure helpers of the scroll occlusion script (task 20.3).
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  samplePoints,
  scrollOffsets,
  summarizeHits,
} from "../../docs/design-review/tools/scroll-occlusion-check.mjs";

describe("scrollOffsets", () => {
  it("walks top to bottom and always ends exactly at the bottom", () => {
    expect(scrollOffsets(1000, 400, 200)).toEqual([0, 200, 400, 600]);
    expect(scrollOffsets(1050, 400, 200)).toEqual([0, 200, 400, 600, 650]);
  });
  it("returns [0] for content that does not scroll or a bad step", () => {
    expect(scrollOffsets(400, 400, 100)).toEqual([0]);
    expect(scrollOffsets(1000, 400, 0)).toEqual([0]);
    expect(scrollOffsets(Number.NaN, 400, 100)).toEqual([0]);
  });
  it("is non-decreasing and ends at max for any input", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6000 }),
        fc.integer({ min: 1, max: 1200 }),
        fc.integer({ min: 1, max: 600 }),
        (sh, ch, step) => {
          const out = scrollOffsets(sh, ch, step);
          for (let i = 1; i < out.length; i++) expect(out[i]).toBeGreaterThan(out[i - 1]);
          expect(out[out.length - 1]).toBe(Math.max(0, sh - ch));
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("samplePoints", () => {
  it("covers the rect and stays inside the viewport", () => {
    const pts = samplePoints({ x: -20, y: 10, w: 100, h: 50 }, 8, { w: 60, h: 40 });
    expect(pts.length).toBeGreaterThan(0);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(60);
      expect(p.y).toBeGreaterThanOrEqual(10);
      expect(p.y).toBeLessThan(40);
    }
  });
  it("returns nothing for a rect outside the viewport", () => {
    expect(samplePoints({ x: 500, y: 0, w: 10, h: 10 }, 4, { w: 100, h: 100 })).toEqual([]);
  });
});

describe("summarizeHits", () => {
  it("groups by chrome, creature and part with a point count", () => {
    const out = summarizeHits([
      { chrome: "chips", creature: "a", part: "sprite" },
      { chrome: "chips", creature: "a", part: "sprite" },
      { chrome: "chips", creature: "a", part: "plaque" },
      { chrome: "pager", creature: "b", part: "sprite" },
    ]);
    expect(out).toHaveLength(3);
    expect(out.find((o) => o.part === "sprite" && o.creature === "a")?.points).toBe(2);
    expect(summarizeHits([])).toEqual([]);
  });
});
