/**
 * Unit tests for the pure helpers of the resolution sweep (task 25.3).
 * Importing the module must not launch a browser.
 */
import { describe, expect, it } from "vitest";

import {
  ALL_HEIGHTS,
  ALL_WIDTHS,
  analyze,
  buildMatrix,
  clipToViewport,
  findSideSpill,
  parseNumList,
  parseSizes,
  summarizePairs,
} from "../../docs/design-review/tools/resolution-sweep.mjs";

describe("resolution-sweep parsing", () => {
  it("parses number lists and drops junk", () => {
    expect(parseNumList("320, 360,abc,0,-5,414")).toEqual([320, 360, 414]);
    expect(parseNumList(undefined)).toEqual([]);
  });

  it("parses WxH sizes and drops malformed entries", () => {
    expect(parseSizes("1024x500,390x844,bad,10")).toEqual([
      [1024, 500],
      [390, 844],
    ]);
  });
});

describe("buildMatrix", () => {
  it("full is widths x heights", () => {
    expect(buildMatrix({ mode: "full" })).toHaveLength(ALL_WIDTHS.length * ALL_HEIGHTS.length);
  });

  it("subset is every width at 500/720/900 plus every height at 390/1024/1440, without duplicates", () => {
    const m = buildMatrix({ mode: "subset" });
    const keys = m.map(([w, h]) => `${w}x${h}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(m).toHaveLength(ALL_WIDTHS.length * 3 + 3 * ALL_HEIGHTS.length - 9);
    expect(keys).toContain("1024x500");
    expect(keys).toContain("2560x900");
    expect(keys).toContain("390x1080");
    expect(keys).not.toContain("2560x1080");
  });

  it("honours configured widths and heights", () => {
    expect(buildMatrix({ mode: "full", widths: [320], heights: [480, 500] })).toEqual([
      [320, 480],
      [320, 500],
    ]);
  });
});

describe("clipToViewport and findSideSpill", () => {
  it("clips to the viewport and drops boxes fully outside", () => {
    expect(clipToViewport({ name: "a", x: -10, y: 5, w: 30, h: 10 }, 100, 100)).toMatchObject({ x: 0, w: 20, y: 5, h: 10 });
    expect(clipToViewport({ name: "a", x: 120, y: 5, w: 30, h: 10 }, 100, 100)).toBeNull();
  });

  it("reports chrome that leaves the viewport sideways, using the unclipped box", () => {
    const items = [
      { name: "chips", x: 0, y: 0, w: 100, h: 10, full: { x: 0, w: 140 } },
      { name: "tag:x", x: 0, y: 0, w: 500, h: 10 },
      { name: "pager", x: 10, y: 0, w: 50, h: 10 },
    ];
    expect(findSideSpill(items, 100, ["chips", "pager"])).toEqual([{ name: "chips", spill: 40 }]);
  });
});

describe("analyze", () => {
  const page = (items: object[], skip: [string, string][] = [], sw = 100) =>
    JSON.stringify({ items, skip, vw: 100, vh: 100, sw, font: null });

  it("finds overlaps between unrelated boxes and ignores parent/child pairs", () => {
    const raw = page(
      [
        { name: "header", x: 0, y: 0, w: 100, h: 40 },
        { name: "header.h1", x: 0, y: 0, w: 50, h: 20 },
        { name: "legend", x: 0, y: 30, w: 60, h: 30 },
      ],
      [["header", "header.h1"]],
    );
    const res = analyze(raw);
    expect(res.overlaps).toEqual([{ a: "header", b: "legend", w: 60, h: 10 }]);
    expect(res.hScroll).toBe(0);
  });

  it("flags horizontal document scroll", () => {
    expect(analyze(page([], [], 130)).hScroll).toBe(30);
  });

  it("is clean for separated boxes", () => {
    const res = analyze(
      page([
        { name: "pager", x: 0, y: 80, w: 40, h: 10 },
        { name: "legend", x: 50, y: 80, w: 40, h: 10 },
      ]),
    );
    expect(res.overlaps).toEqual([]);
    expect(res.spill).toEqual([]);
  });
});

describe("summarizePairs", () => {
  it("collapses repeated pairs to the worst case", () => {
    const f = (size: string, w: number, h: number) => ({ page: "estate", place: "hub", size, a: "x", b: "y", w, h });
    const out = summarizePairs([f("1x1", 2, 2), f("2x2", 10, 10), f("3x3", 1, 1)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ count: 3, pair: "x x y" });
    expect(out[0].worst.size).toBe("2x2");
  });
});
