/**
 * Unit tests for the pure rect helpers of the real-browser layout check
 * (task 20.2). Importing the module must not launch a browser.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { findOverlaps, rectOverlap } from "../../docs/design-review/tools/overlap-check.mjs";

describe("rectOverlap", () => {
  it("returns the intersection size", () => {
    expect(rectOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 6, w: 10, h: 10 })).toEqual({
      w: 5,
      h: 4,
      area: 20,
    });
  });

  it("treats touching edges and gaps as no overlap", () => {
    expect(rectOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 })).toBeNull();
    expect(rectOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 12, w: 5, h: 5 })).toBeNull();
  });

  it("ignores overlaps within the tolerance", () => {
    expect(rectOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 9.8, y: 0, w: 5, h: 5 })).toBeNull();
  });

  it("is symmetric", () => {
    const a = { x: 1, y: 2, w: 30, h: 8 };
    const b = { x: 20, y: 5, w: 30, h: 8 };
    expect(rectOverlap(a, b)).toEqual(rectOverlap(b, a));
  });
});

describe("findOverlaps", () => {
  it("lists overlapping pairs and skips nested ones", () => {
    const items = [
      { name: "header", x: 0, y: 0, w: 100, h: 100, skipWith: ["header.btn"] },
      { name: "header.btn", x: 10, y: 10, w: 20, h: 20 },
      { name: "heading", x: 50, y: 90, w: 20, h: 20 },
    ];
    expect(findOverlaps(items)).toEqual([{ a: "header", b: "heading", w: 20, h: 10 }]);
  });
});

describe("layout overlap structure (task 20.2)", () => {
  const src = (p: string) => readFileSync(p, "utf8");

  it("the header publishes its real height on wide layouts too", () => {
    expect(src("components/ui/Header.tsx")).toMatch(/useHeaderHeightVar\([^)]*always: true/);
  });

  it("the hub whisper is hidden in the stacked layout only", () => {
    const map = src("components/scene/EstateMap.tsx");
    expect(map).toContain("max-[767px]:hidden [&>*]:line-clamp-2");
  });

  it("world and gate bottom bars are lifted above the footer row", () => {
    expect(src("components/world/WorldPlaceView.tsx")).toMatch(/2\.75rem[\s\S]*4rem|4rem[\s\S]*2\.75rem/);
    expect(src("components/scene/GatePlaceView.tsx")).toContain("calc(2.75rem + env(safe-area-inset-bottom");
  });

  it("the Return button has its own slot below the header band", () => {
    expect(src("components/world/WorldPlaceView.tsx")).toContain("absolute left-6 top-6");
  });
});
