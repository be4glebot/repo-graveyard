/**
 * The ritual's pixel layout: the five candles sit on an ellipse clearly outside
 * the portrait's bounding box, the top candle above its head, for any size.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  RITUAL_DEFAULT_BOX,
  RITUAL_PORTRAIT_GAP_PX,
  RITUAL_PORTRAIT_MAX_PX,
  RITUAL_PORTRAIT_MIN_PX,
  ritualCandleHeight,
  ritualCandles,
  ritualGeometry,
  type PxBox,
} from "@/lib/seance-ritual";

const separation = (a: PxBox, b: PxBox): number => {
  const dx = Math.max(b.left - a.right, a.left - b.right);
  const dy = Math.max(b.top - a.bottom, a.top - b.bottom);
  return Math.max(dx, dy); // > 0 means the boxes do not touch
};

describe("ritualGeometry (default size)", () => {
  const g = ritualGeometry();

  it("defaults to the unmeasured box and is deterministic", () => {
    expect(g.box).toEqual(RITUAL_DEFAULT_BOX);
    expect(ritualGeometry()).toEqual(g);
    expect(ritualGeometry({})).toEqual(g);
  });

  it("the portrait is slightly larger than before (168 px) and centred horizontally", () => {
    expect(g.portrait.size).toBe(RITUAL_PORTRAIT_MAX_PX);
    expect(g.portrait.size).toBeGreaterThan(136);
    expect(g.portrait.cx).toBe(g.box.width / 2);
  });

  it("five candles, none touching the portrait box (a clear gap)", () => {
    expect(g.candles).toHaveLength(5);
    for (const c of g.candles) {
      expect(separation(c.box, g.portrait.box), `candle ${c.index}`).toBeGreaterThanOrEqual(
        RITUAL_PORTRAIT_GAP_PX - 0.5,
      );
    }
  });

  it("the top candle is above the portrait's head", () => {
    const top = g.candles[0];
    expect(top.x).toBeCloseTo(g.portrait.cx, 0);
    expect(top.box.bottom).toBeLessThanOrEqual(g.portrait.box.top - RITUAL_PORTRAIT_GAP_PX + 0.5);
  });

  it("the other candles sit beside and below the portrait on one ellipse", () => {
    const [, right, lowerRight, lowerLeft, left] = g.candles;
    expect(right.x).toBeGreaterThan(g.portrait.box.right);
    expect(left.x).toBeLessThan(g.portrait.box.left);
    expect(lowerRight.box.top).toBeGreaterThan(g.portrait.box.bottom);
    expect(lowerLeft.box.top).toBeGreaterThan(g.portrait.box.bottom);
    // The widest candles (at 18 and 198 degrees) are at cos(18 deg) of the x radius.
    const rx = Math.max(...g.candles.map((c) => Math.abs(c.x - g.portrait.cx))) / Math.cos((18 * Math.PI) / 180);
    const ry = g.portrait.cy - g.candles[0].y;
    for (const c of g.candles) {
      const u = (c.x - g.portrait.cx) / rx;
      const v = (c.y - g.portrait.cy) / ry;
      // Every candle's anchor is on the same ellipse (within the 0.1 px rounding).
      expect(Math.hypot(u, v)).toBeGreaterThan(0.99);
      expect(Math.hypot(u, v)).toBeLessThan(1.01);
    }
  });

  it("everything fits inside the ritual box, above the stage text", () => {
    for (const c of g.candles) {
      expect(c.box.left).toBeGreaterThanOrEqual(0);
      expect(c.box.right).toBeLessThanOrEqual(g.box.width);
      expect(c.box.top).toBeGreaterThanOrEqual(0);
    }
    const bottom = Math.max(...g.candles.map((c) => c.box.bottom));
    expect(bottom).toBeLessThanOrEqual(g.box.height - 112 + 8);
    expect(g.textTop).toBeGreaterThanOrEqual(bottom);
    expect(g.textTop).toBeLessThanOrEqual(g.box.height - 104);
  });

  it("candle heights follow the uneven height scales", () => {
    const scales = ritualCandles().map((c) => c.heightScale);
    expect(g.candles.map((c) => c.height)).toEqual(scales.map(ritualCandleHeight));
    expect(new Set(g.candles.map((c) => c.height)).size).toBeGreaterThan(1);
  });
});

describe("ritualGeometry (any size)", () => {
  it("property: candles never touch the portrait and stay inside the width", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 1400 }),
        fc.integer({ min: 200, max: 1400 }),
        (width, height) => {
          const g = ritualGeometry({ width, height });
          expect(g.portrait.size).toBeGreaterThanOrEqual(RITUAL_PORTRAIT_MIN_PX);
          expect(g.portrait.size).toBeLessThanOrEqual(RITUAL_PORTRAIT_MAX_PX);
          for (const c of g.candles) {
            expect(separation(c.box, g.portrait.box)).toBeGreaterThanOrEqual(
              RITUAL_PORTRAIT_GAP_PX - 0.5,
            );
            expect(c.box.left).toBeGreaterThanOrEqual(0);
            expect(c.box.right).toBeLessThanOrEqual(width);
          }
          expect(g.candles[0].box.bottom).toBeLessThanOrEqual(g.portrait.box.top);
          expect(g.portrait.cx).toBe(width / 2);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("property: when the ritual is tall enough the whole block fits above the text", () => {
    fc.assert(
      fc.property(fc.integer({ min: 320, max: 1000 }), fc.integer({ min: 560, max: 1400 }), (width, height) => {
        const g = ritualGeometry({ width, height });
        const bottom = Math.max(...g.candles.map((c) => c.box.bottom));
        expect(bottom).toBeLessThanOrEqual(height - 112 + 8);
        expect(Math.min(...g.candles.map((c) => c.box.top))).toBeGreaterThanOrEqual(8);
      }),
      { numRuns: 200 },
    );
  });

  it("is total: junk sizes fall back to the default box", () => {
    for (const bad of [Number.NaN, -5, 0, Number.POSITIVE_INFINITY]) {
      const g = ritualGeometry({ width: bad, height: bad });
      expect(g.portrait.size).toBeGreaterThan(0);
    }
    expect(ritualGeometry({ width: Number.NaN, height: Number.NaN }).box).toEqual(RITUAL_DEFAULT_BOX);
  });

  it("a short ritual shrinks the portrait (never below the minimum)", () => {
    expect(ritualGeometry({ width: 420, height: 400 }).portrait.size).toBeLessThan(RITUAL_PORTRAIT_MAX_PX);
    expect(ritualGeometry({ width: 420, height: 260 }).portrait.size).toBe(RITUAL_PORTRAIT_MIN_PX);
  });
});