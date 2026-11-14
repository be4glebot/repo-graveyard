import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { NOTICE_EDGE, NOTICE_GAP, noticePlacement } from "@/lib/notice-placement";

const rect = (left: number, top: number, w: number, h: number) => ({ left, top, right: left + w, bottom: top + h });

describe("noticePlacement", () => {
  it("uses the lane right of the Sky when wide enough", () => {
    const p = noticePlacement({ vw: 1440, headerBottom: 100, sky: rect(500, 120, 300, 200), plaque: rect(520, 120, 260, 100) });
    expect(p.anchor).toBe("lane");
    expect(p.left).toBeGreaterThan(800);
    expect(p.top).toBeGreaterThanOrEqual(110);
  });

  it("falls back to above the plaque when the lane is narrow, never under the header", () => {
    const p = noticePlacement({ vw: 800, headerBottom: 100, sky: rect(300, 300, 260, 200), plaque: rect(320, 400, 220, 90), noticeH: 40 });
    expect(p.anchor).toBe("above");
    expect(p.top).toBe(400 - NOTICE_GAP - 40);
    const tight = noticePlacement({ vw: 800, headerBottom: 100, sky: rect(300, 120, 260, 200), plaque: rect(320, 120, 220, 90), noticeH: 40 });
    expect(tight.top).toBeGreaterThanOrEqual(100 + NOTICE_GAP);
  });

  it("uses a narrower wrapped lane instead of landing on the plaque when there is no room above it", () => {
    // 820 wide: lane = 820 - 12 - (500 + 24) = 284 is wide enough already; use 780 for a 244px lane.
    const p = noticePlacement({ vw: 780, headerBottom: 120, sky: rect(240, 150, 260, 150), plaque: rect(240, 168, 260, 96), noticeH: 44 });
    expect(p.anchor).toBe("lane");
    expect(p.left).toBe(524);
    expect(p.maxWidth).toBe(780 - 12 - 524);
    // Wide sprites beside the plaque: the lane may start beside the plaque instead.
    const wide = noticePlacement({ vw: 780, headerBottom: 120, sky: rect(160, 15, 421, 250), plaque: rect(240, 168, 260, 96), noticeH: 44 });
    expect(wide.anchor).toBe("lane");
    expect(wide.left).toBe(524);
    // A lane below the wrap minimum keeps the old behaviour.
    const none = noticePlacement({ vw: 700, headerBottom: 120, sky: rect(240, 150, 260, 150), plaque: rect(240, 168, 260, 96), noticeH: 44 });
    expect(none.anchor).toBe("above");
  });
  it("stays on screen and finite for any input", () => {
    fc.assert(
      fc.property(fc.integer({ min: 320, max: 2560 }), fc.integer({ min: 0, max: 200 }), fc.integer({ min: 0, max: 2000 }), fc.integer({ min: 0, max: 800 }), (vw, hb, left, top) => {
        const p = noticePlacement({ vw, headerBottom: hb, sky: rect(left, top, 260, 200), plaque: rect(left, top + 100, 260, 90) });
        expect(Number.isFinite(p.left) && Number.isFinite(p.top)).toBe(true);
        expect(p.top).toBeGreaterThanOrEqual(hb + NOTICE_GAP);
        expect(p.left).toBeGreaterThanOrEqual(NOTICE_EDGE - 0.001);
      }),
    );
  });
});
