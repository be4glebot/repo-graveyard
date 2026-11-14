/**
 * Task 21.1: Hallowed Ground two staggered rows per side of the path.
 * Unit examples plus a property check (plaque non-overlap 360..1920, no
 * duplicate slots, sparse counts 1-5, corridor minimum where the width allows).
 */
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";

import { WORLD_CONFIG, computeWorldLayout, type WorldLayout } from "@/lib/world-layout";
import { pathXAt } from "@/components/world/GroundArt";

const names = (n: number): string[] => Array.from({ length: n }, (_, i) => `repo-${i}`);
const ground = (n: number, w: number, h = 900): WorldLayout =>
  computeWorldLayout({ place: "ground", names: names(n), viewportW: w, viewportH: h });

/** Distance of a slot's plaque edge nearest the path, from the path centreline. */
function gapToPath(l: WorldLayout, i: number): number {
  const s = l.slots[i];
  const c = pathXAt(l.path, s.cy, l.slots[i].cx);
  return s.side === -1 ? c - s.plaque.right : s.plaque.left - c;
}

describe("ground two-row arrangement", () => {
  it("wide screens use two lanes per side: four distinct x bands for 12 names", () => {
    const l = ground(12, 1440);
    for (const side of [-1, 1] as const) {
      const offs = l.slots
        .filter((s) => s.side === side)
        .map((s) => Math.abs(s.cx - pathXAt(l.path, s.cy, 0)))
        .sort((a, b) => a - b);
      // Two clusters (inner and outer lane); path samples are linear, so allow a few px.
      const clusters = offs.filter((v, i) => i === 0 || v - offs[i - 1] > 40).length;
      expect(clusters).toBe(2);
    }
    for (const side of [-1, 1] as const) {
      expect(l.slots.filter((s) => s.side === side)).toHaveLength(6);
    }
  });

  it("rows are staggered: neighbours in one lane are never at the same y", () => {
    const l = ground(12, 1440);
    const ys = l.slots.map((s) => s.cy);
    expect(new Set(ys).size).toBe(ys.length);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
    expect(l.domOrder).toEqual(l.slots.map((_, i) => i));
  });

  it("keeps the walking corridor wherever the width allows it", () => {
    for (const w of [800, 1024, 1280, 1440, 1920]) {
      const l = ground(12, w);
      const min = Math.min(...l.slots.map((_, i) => gapToPath(l, i)));
      expect(min * 2).toBeGreaterThanOrEqual(WORLD_CONFIG.GROUND_CORRIDOR_MIN - 12);
    }
  });

  it("is closer to the path than the old far-edge placement", () => {
    const l = ground(12, 1440);
    const far = Math.max(...l.slots.map((s) => Math.abs(s.cx - 720)));
    expect(far).toBeLessThan(720 - 108 - 100);
  });

  it("degrades to one lane per side at narrow widths", () => {
    const l = ground(12, 390);
    const offs = new Set(
      l.slots.map((s) => `${s.side}:${Math.round(Math.abs(s.cx - 195))}`),
    );
    expect(offs.size).toBeLessThanOrEqual(2 * 2);
    for (const s of l.slots) {
      expect(s.plaque.left).toBeGreaterThanOrEqual(WORLD_CONFIG.SIDE_MARGIN - 1e-6);
      expect(s.plaque.right).toBeLessThanOrEqual(390 - WORLD_CONFIG.SIDE_MARGIN + 1e-6);
    }
  });

  it("sparse plots (2-5) fill alternating sides from the front, one slot per name", () => {
    for (const n of [1, 2, 3, 4, 5]) {
      for (const w of [390, 1440]) {
        const l = ground(n, w);
        expect(l.slots).toHaveLength(n);
        expect(new Set(l.slots.map((s) => s.index)).size).toBe(n);
        if (n >= 2) {
          expect(l.slots[0].side).toBe(-1);
          expect(l.slots[1].side).toBe(1);
          const left = l.slots.filter((s) => s.side === -1).length;
          const right = l.slots.filter((s) => s.side === 1).length;
          expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
        }
      }
    }
    // A lone tombstone is centred (the property suite requires it).
    expect(ground(1, 1440).slots[0].cx).toBeCloseTo(720, 5);
  });

  it("sparse plots up to four stay in the inner lane", () => {
    const l = ground(4, 1440);
    const dists = l.slots.map((s) => Math.abs(s.cx - pathXAt(l.path, s.cy, 0)));
    expect(Math.max(...dists) - Math.min(...dists)).toBeLessThan(12);
  });
});

describe("ground two-row arrangement (properties)", () => {
  it("plaques never overlap and stay in the margins for any count 1..12 at widths 360..1920", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 360, max: 1920 }),
        fc.integer({ min: 600, max: 1200 }),
        (n, w, h) => {
          const l = ground(n, w, h);
          expect(l.slots).toHaveLength(n);
          const eps = 1e-6;
          for (let i = 0; i < n; i++) {
            const a = l.slots[i].plaque;
            expect(a.left).toBeGreaterThanOrEqual(WORLD_CONFIG.SIDE_MARGIN - eps);
            expect(a.right).toBeLessThanOrEqual(w - WORLD_CONFIG.SIDE_MARGIN + eps);
            for (let j = i + 1; j < n; j++) {
              const b = l.slots[j].plaque;
              const overlap =
                a.left < b.right - eps &&
                b.left < a.right - eps &&
                a.top < b.bottom - eps &&
                b.top < a.bottom - eps;
              expect(overlap).toBe(false);
            }
          }
          // Corridor wherever two-lane or one-lane has room for it.
          if (w >= 800 && n >= 2) {
            for (let i = 0; i < n; i++) {
              expect(gapToPath(l, i) * 2).toBeGreaterThanOrEqual(
                WORLD_CONFIG.GROUND_CORRIDOR_MIN - 12,
              );
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
