import { describe, expect, it } from "vitest";
import { PAINTED_MOON } from "@/lib/estate-view";
import {
  bleedPx,
  computeCrop,
  plateToStage,
  PLATE_SIZE,
  WORLD_ART,
} from "@/lib/world-art";

describe("world-art", () => {
  const element = { w: 1960, h: 1560 };

  it("scales uniformly and keeps the rect inside the plate", () => {
    for (const specs of Object.values(WORLD_ART)) {
      for (const s of specs) {
        const plate = PLATE_SIZE[s.plate];
        const c = computeCrop({ plate, element, focal: s.focal, anchor: s.anchor, flip: s.flip, offset: s.offset });
        expect(c.rect.w * c.scale).toBeCloseTo(element.w, 6);
        expect(c.rect.h * c.scale).toBeCloseTo(element.h, 6);
        expect(c.rect.x).toBeGreaterThanOrEqual(0);
        expect(c.rect.y).toBeGreaterThanOrEqual(0);
        expect(c.rect.x + c.rect.w).toBeLessThanOrEqual(plate.w + 1e-9);
        expect(c.rect.y + c.rect.h).toBeLessThanOrEqual(plate.h + 1e-9);
        expect(c.upscale).toBeLessThanOrEqual(1.75);
      }
    }
  });

  it("matches the worked example scale of 1.52", () => {
    const c = computeCrop({
      plate: PLATE_SIZE["place-sky"],
      element,
      focal: { fx: 0.5, fy: 0.5 },
      anchor: { ax: 0.5, ay: 0.5 },
      flip: { h: false, v: false },
    });
    expect(c.scale).toBeCloseTo(1.523, 2);
  });

  it("places the painted moon where the painted pixels land", () => {
    const s = WORLD_ART.sky[0];
    const c = computeCrop({ plate: PLATE_SIZE[s.plate], element, focal: s.focal, anchor: s.anchor, flip: s.flip });
    const p = plateToStage(c, element, PAINTED_MOON.fx, PAINTED_MOON.fy);
    const plate = PLATE_SIZE[s.plate];
    expect(p.x).toBeCloseTo((PAINTED_MOON.fx * plate.w - c.rect.x) * c.scale, 6);
    expect(p.y).toBeCloseTo((PAINTED_MOON.fy * plate.h - c.rect.y) * c.scale, 6);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThanOrEqual(element.w);
  });

  it("maps the focal point to the anchor when the rect is not clamped, incl. flips", () => {
    const wide = { w: 1000, h: 400 }; // spare height, so the y anchor is free
    const flip = { h: true, v: true };
    const c = computeCrop({
      plate: PLATE_SIZE["place-sky"],
      element: wide,
      focal: { fx: 0.5, fy: 0.5 },
      anchor: { ax: 0.5, ay: 0.4 },
      flip,
    });
    const p = plateToStage(c, wide, 0.5, 0.5);
    expect(p.x).toBeCloseTo(0.5 * wide.w, 3);
    expect(p.y).toBeCloseTo(0.4 * wide.h, 3);
  });

  it("computes bleed from rate, and 8 px under reduced motion", () => {
    const base = { viewportH: 1080, stratumH: 1080, blendH: 162, maxPointer: 8, drift: 12 };
    const bg = bleedPx({ ...base, rate: 0.88, reduced: false });
    expect(bg.y).toBeGreaterThanOrEqual(0.12 * 1.075 * 1080 + 20);
    expect(bg.y).toBeLessThan(165);
    expect(bg.x).toBe(20);
    expect(bleedPx({ ...base, rate: 0.88, reduced: true })).toEqual({ x: 8, y: 8 });
  });
});
