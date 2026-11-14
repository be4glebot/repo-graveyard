/**
 * Task 22.1: Hallowed Ground at browser-zoom extremes (CSS viewports 200..6000
 * wide, 150..4000 tall). Layout properties stay true, the group hugs the path
 * in a bounded column on huge screens, and the mist layer always covers the
 * stage.
 */
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";

import { WORLD_CONFIG, computeWorldLayout, type WorldLayout } from "@/lib/world-layout";
import { MIST_FEATHER_OVERSCAN, MIST_MIN_WIDTH, mistLayerWidth } from "@/components/world/EnvMist";
import { pathXAt } from "@/components/world/GroundArt";
import { arbExtremeViewport } from "../property/helpers/world-arbitraries";

const names = (n: number): string[] => Array.from({ length: n }, (_, i) => `repo-${i}`);
const ground = (n: number, w: number, h: number): WorldLayout =>
  computeWorldLayout({ place: "ground", names: names(n), viewportW: w, viewportH: h });

describe("ground layout at zoom extremes", () => {
  it("keeps bounds, no duplicates, DOM order and non-overlap for any viewport 200x150..6000x4000", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 12 }), arbExtremeViewport, (n, v) => {
        const l = ground(n, v.viewportW, v.viewportH);
        expect(l.slots).toHaveLength(n);
        expect(new Set(l.slots.map((s) => s.index)).size).toBe(n);
        expect(l.domOrder).toEqual(l.slots.map((_, i) => i));
        const eps = 1e-6;
        for (let i = 0; i < n; i++) {
          const a = l.slots[i];
          expect(Number.isFinite(a.cx) && Number.isFinite(a.cy)).toBe(true);
          expect(a.cy).toBeGreaterThanOrEqual(0);
          expect(a.cy).toBeLessThanOrEqual(l.heightPx);
          // Plaques stay inside the side margins whenever the width can hold one.
          if (v.viewportW >= 360) {
            expect(a.plaque.left).toBeGreaterThanOrEqual(WORLD_CONFIG.SIDE_MARGIN - eps);
            expect(a.plaque.right).toBeLessThanOrEqual(v.viewportW - WORLD_CONFIG.SIDE_MARGIN + eps);
          }
          for (let j = i + 1; j < n; j++) {
            const b = l.slots[j];
            const overlap =
              a.plaque.left < b.plaque.right - eps &&
              b.plaque.left < a.plaque.right - eps &&
              a.plaque.top < b.plaque.bottom - eps &&
              b.plaque.top < a.plaque.bottom - eps;
            expect(overlap).toBe(false);
          }
          // The mausoleum sits below the last slot.
        }
        // Gap fillers reuse the kind, so the real one is the lowest.
        const maus = Math.max(...l.features.filter((f) => f.kind === "mausoleum").map((f) => f.y));
        if (n >= 2) expect(maus).toBeGreaterThan(Math.max(...l.slots.map((s) => s.cy)));
      }),
      { numRuns: 300 },
    );
  });

  it("keeps the walking corridor wherever the width allows it, up to 6000 px", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 12 }),
        fc.integer({ min: 800, max: 6000 }),
        fc.integer({ min: 600, max: 4000 }),
        (n, w, h) => {
          const l = ground(n, w, h);
          for (const s of l.slots) {
            const c = pathXAt(l.path, s.cy, s.cx);
            const gap = s.side === -1 ? c - s.plaque.right : s.plaque.left - c;
            expect(gap * 2).toBeGreaterThanOrEqual(WORLD_CONFIG.GROUND_CORRIDOR_MIN - 12);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("on very wide screens the group stays in a bounded column around the path", () => {
    const widths = [1920, 3840, 5120, 6000];
    const reach = widths.map((w) => {
      const l = ground(12, w, 1600);
      return Math.max(...l.slots.map((s) => Math.abs(s.cx - pathXAt(l.path, s.cy, w / 2))));
    });
    // Wider than the design width never pushes stones further out than the
    // clamped spread allows (about 2x the 1920 reach), so they never scatter.
    expect(reach[3]).toBeLessThan(reach[0] * 2.2);
    expect(reach[3]).toBeLessThan(900);
    // 5120 is no tighter than 1920 (the corridor never shrinks).
    expect(reach[2]).toBeGreaterThanOrEqual(reach[0] - 1);
  });

  it("tiny viewports degrade to one lane per side without leaving the screen", () => {
    for (const [w, h] of [[320, 480], [400, 300], [200, 150], [360, 150]]) {
      const l = ground(12, w, h);
      const lanes = new Set(l.slots.map((s) => `${s.side}:${Math.round(Math.abs(s.cx - w / 2))}`));
      expect(lanes.size).toBeLessThanOrEqual(w < 404 ? 8 : 4);
      for (const s of l.slots) expect(s.cx).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("mist layer covers the stage at any viewport", () => {
  it("is at least the stage width (plus overscan when feathered) in both modes", () => {
    fc.assert(
      fc.property(fc.integer({ min: 200, max: 8000 }), fc.boolean(), (w, feather) => {
        const layer = mistLayerWidth(w, feather);
        const box = feather ? w * (1 + 2 * MIST_FEATHER_OVERSCAN) : w;
        expect(layer).toBeGreaterThanOrEqual(box);
        expect(layer).toBeGreaterThanOrEqual(MIST_MIN_WIDTH);
        // Sway headroom: +-2 percent never exposes an edge.
        expect(layer).toBeGreaterThanOrEqual(box * 1.04 - 1);
      }),
    );
  });

  it("keeps the original width on ordinary screens and survives bad input", () => {
    expect(mistLayerWidth(1440)).toBe(2048);
    expect(mistLayerWidth(390, true)).toBe(2048);
    expect(mistLayerWidth(Number.NaN)).toBe(2048);
    expect(mistLayerWidth(-5, true)).toBe(2048);
    expect(mistLayerWidth(5120)).toBe(6144);
  });
});
