import { describe, expect, it } from "vitest";
import {
  estateChromeRects,
  rectsIntersect,
  whisperLane,
} from "@/lib/estate-view";

const WIDTHS = [768, 800, 1024, 1280, 1440];
const HEIGHTS = [700, 750, 800, 900, 1000];

describe("whisperLane", () => {
  for (const w of WIDTHS) {
    for (const h of HEIGHTS) {
      it(`clears every place card, header and legend at ${w}x${h}`, () => {
        const lane = whisperLane(w, h);
        const { placeCards, header, legend } = estateChromeRects(w, h);
        expect(placeCards).toHaveLength(4);
        for (const card of placeCards) {
          expect(rectsIntersect(lane, card)).toBe(false);
        }
        expect(rectsIntersect(lane, header)).toBe(false);
        expect(rectsIntersect(lane, legend)).toBe(false);
      });
    }
  }

  it("treats touching edges as clear and overlap as intersecting", () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(rectsIntersect(a, { left: 10, top: 0, right: 20, bottom: 10 })).toBe(false);
    expect(rectsIntersect(a, { left: 0, top: 10, right: 10, bottom: 20 })).toBe(false);
    expect(rectsIntersect(a, { left: 9, top: 9, right: 20, bottom: 20 })).toBe(true);
  });

  it("coerces non-finite input without throwing", () => {
    const lane = whisperLane(Number.NaN, Number.POSITIVE_INFINITY);
    expect(Object.values(lane).every(Number.isFinite)).toBe(true);
  });
});
