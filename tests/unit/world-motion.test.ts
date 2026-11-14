import { describe, expect, it } from "vitest";
import {
  BAND_RATES,
  GESTURE_TAP_MAX_PX,
  ambientBrightness,
  bandOffset,
  classifyGesture,
  depthPosition,
  scrollTargetFor,
  stratumAt,
} from "../../lib/world-motion";

describe("world-motion", () => {
  it("exposes the band rates in order", () => {
    expect(Object.values(BAND_RATES)).toEqual([0.88, 0.94, 1, 1.06, 1.12]);
    expect(GESTURE_TAP_MAX_PX).toBe(8);
  });

  it("depthPosition clamps and never returns NaN", () => {
    expect(depthPosition(500, 1000, 500)).toBe(1);
    expect(depthPosition(250, 1000, 500)).toBe(0.5);
    expect(depthPosition(-5, 1000, 500)).toBe(0);
    expect(depthPosition(10, 500, 500)).toBe(0);
    expect(depthPosition(10, 1000, 0)).toBe(0);
    expect(depthPosition(NaN, 1000, 500)).toBe(0);
  });

  it("stratumAt finds the stratum under the viewport centre", () => {
    const strata = [
      { top: 0, bottom: 800 },
      { top: 800, bottom: 1600 },
    ] as never;
    const layout = { strata };
    expect(stratumAt(layout, 0, 800)).toBe(0);
    expect(stratumAt(layout, 600, 800)).toBe(1);
    expect(stratumAt(layout, 9999, 800)).toBe(1);
    expect(stratumAt({ strata: [] }, 0, 800)).toBe(0);
  });

  it("bandOffset uses pointer maxima, no pointer for creatures, zero when reduced", () => {
    const inp = { px: 1, py: 1, scroll: 0, anchor: 0, reduced: false };
    expect(bandOffset("background", inp)).toEqual({ x: 8, y: 8 });
    expect(bandOffset("midground", inp).x).toBe(16);
    expect(bandOffset("nearMist", inp).x).toBe(26);
    expect(bandOffset("creature", { ...inp, scroll: 400 })).toEqual({ x: 0, y: 0 });
    expect(bandOffset("foreground", { ...inp, reduced: true })).toEqual({ x: 0, y: 0 });
    expect(bandOffset("background", { ...inp, px: 0, py: 0, scroll: 100 }).y).toBeCloseTo(12);
  });

  it("ambientBrightness is 1 at 0 and at least 0.8 at 1", () => {
    expect(ambientBrightness(0)).toBe(1);
    expect(ambientBrightness(1)).toBeGreaterThanOrEqual(0.8);
    expect(ambientBrightness(0.5)).toBeLessThanOrEqual(ambientBrightness(0.25));
  });

  it("scrollTargetFor centres the slot within the scroll range", () => {
    expect(scrollTargetFor({ cy: 1000 }, 2000, 800)).toBe(600);
    expect(scrollTargetFor({ cy: 100 }, 2000, 800)).toBe(0);
    expect(scrollTargetFor({ cy: 1990 }, 2000, 800)).toBe(1200);
  });

  it("classifyGesture treats up to 8 px as a tap", () => {
    expect(classifyGesture(0, 0)).toBe("tap");
    expect(classifyGesture(8, 0)).toBe("tap");
    expect(classifyGesture(5, 5)).toBe("tap");
    expect(classifyGesture(0, 9)).toBe("scroll");
  });
});
